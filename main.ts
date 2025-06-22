import {
	App,
	Editor,
	MarkdownView,
	normalizePath,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	FuzzySuggestModal,
	FuzzyMatch,
	Vault,
	Setting,
} from "obsidian";

// 扩展 App 类型以包含 commands 属性
declare module "obsidian" {
	interface App {
		commands: {
			removeCommand(id: string): void;
		};
	}
}

// Remember to rename these classes and interfaces!

// 单个端点设置项
interface EndpointSetting {
	name: string;
	url: string;
	apiKey: string;
	path: string;
	id?: string;
	willExport: boolean;
}

// 插件整体设置
interface MyPluginSettings {
	endpoints: EndpointSetting[];
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	endpoints: [
		{
			name: "Default",
			url: "https://example.com",
			apiKey: "",
			path: "",
			willExport: true,
		},
	],
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private commandIds: Set<string> = new Set(); // 跟踪已注册的命令ID

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new EndpointSettingsTab(this.app, this));
		// 初始注册命令
		this.registerEndpointCommands();
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// 确保每个endpoint都有唯一ID
		this.settings.endpoints.forEach((endpoint) => {
			if (!endpoint.id) {
				endpoint.id = this.generateUniqueId();
			}
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 生成唯一ID（使用时间戳+随机数）
	generateUniqueId(): string {
		return `endpoint-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
	}

	// 注册所有端点命令
	private registerEndpointCommands() {
		// 先移除所有旧命令
		this.unregisterAllCommands();

		this.settings.endpoints.forEach((endpoint) => {
			const commandId = `open-${endpoint.id}`;

			this.addCommand({
				id: commandId,
				name: `Open: ${endpoint.name}`,
				callback: async () => {
					// 实际执行操作 - 这里示例为打开URL

					await new AirtableFetcher(
						endpoint,
						this.app
					).createOrUpdateNotesInOBFromSourceTable(endpoint);

					new Notice(`${endpoint.name} is done.`);
				},
			});

			// 记录已注册的命令ID
			this.commandIds.add(commandId);
		});
	}

	// 显示通知的辅助方法
	private showNotification(message: string) {
		new Notification(`Endpoint Command`, {
			body: message,
			silent: true,
		});
	}

	// 注销所有已注册的命令
	private unregisterAllCommands() {
		this.commandIds.forEach((id) => {
			this.app.commands.removeCommand(`${this.manifest.id}:${id}`);
		});
		this.commandIds.clear();
	}

	// 刷新命令（在设置更改后调用）
	public refreshCommands() {
		this.registerEndpointCommands();
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText("Woah!");
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class EndpointSettingsTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题
		containerEl.createEl("h2", { text: "API Endpoints Configuration" });

		// 在同一行添加三个按钮
		new Setting(containerEl)
			.addButton((button) =>
				button
					.setButtonText("+ Add New Endpoint")
					.setCta()
					.onClick(() => {
						this.plugin.settings.endpoints.push({
							name: "",
							url: "",
							apiKey: "",
							path: "",
							willExport: true,
							id: this.plugin.generateUniqueId(), // 生成新ID
						});
						this.plugin.saveSettings();
						this.renderEndpoints(); // 重新渲染
					})
			)
			.addButton((button) =>
				button
					.setButtonText("+ Import New Endpoint")
					.setCta()
					.onClick(async () => {
						const importedEndpoints = await this.importEndpoints();
						if (importedEndpoints?.length) {
							this.plugin.settings.endpoints.push(...importedEndpoints);
							await this.plugin.saveSettings();
							this.renderEndpoints(); // 重新渲染
						}
					})
			)
			.addButton((button) =>
				button
					.setButtonText("Export All Endpoints")
					.setCta()
					.onClick(async () => {
						// 导出所有endpoints设置
						const endpointsToExport = this.plugin.settings.endpoints.map(endpoint => {
							// 创建endpoint的副本并移除id
							const endpointCopy = {...endpoint};
							delete endpointCopy.id;
							return endpointCopy;
						});

						// 筛选出willExport为true的端点
						const endpointsToExportFiltered = endpointsToExport.filter(endpoint => endpoint.willExport);
						
						// 转换为JSON字符串
						const endpointsJson = JSON.stringify(endpointsToExportFiltered, null, 2);
						
						// 复制到剪贴板
						try {
							await navigator.clipboard.writeText(endpointsJson);
							new Notice("All endpoint settings exported to clipboard");
						} catch (err) {
							new Notice("Failed to export endpoint settings");
							console.error("Failed to export endpoint settings:", err);
						}
					})
			)
			;

		// const headings = containerEl.createDiv({cls: "setting-heading"});
		// headings.createEl("strong", {text: "Export"});
		// headings.createEl("strong", {text: "Name"});
		// headings.createEl("strong", {text: "URL"});
		// headings.createEl("strong", {text: "Key"});
		// headings.createEl("strong", {text: "Target"});
		// headings.createEl("strong", {text: "Actions"});
		// 渲染所有端点设置项
		this.renderEndpoints();
	}

	// 导入新端点的方法
	private async importEndpoints(): Promise<EndpointSetting[] | null> {
		// 创建一个模态框用于多行文本输入
		const modal = new Modal(this.app);
		modal.titleEl.setText("Import Endpoints");
		const { contentEl } = modal;

		// 创建文本区域
		const textArea = contentEl.createEl("textarea", {
			attr: {
				rows: "10",
				placeholder: "请粘贴端点配置JSON"
			},
			cls: "full-width-textarea"
		});

		// 添加CSS样式使textarea宽度100%
		textArea.style.width = "100%";
		textArea.style.boxSizing = "border-box";

		// 创建确认按钮
		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container"
		});

		let endpointJsonArray = "";

		// 添加确认按钮
		// 创建确认按钮
		buttonContainer.createEl("button", {
			text: "确认",
			cls: "mod-cta"
		}).addEventListener("click", () => {
			endpointJsonArray = textArea.value;
			modal.close();
		});

		// 创建取消按钮
		buttonContainer.createEl("button", {
			text: "取消"
		}).addEventListener("click", () => {
			endpointJsonArray = "";
			modal.close();
		});

		// 打开模态框并等待用户输入
		await new Promise(resolve => {
			modal.onClose = () => resolve(void 0);
			modal.open();
		});
		if (!endpointJsonArray) {
			return null;
		}
		try {
			const importedEndpointArray = JSON.parse(endpointJsonArray) as EndpointSetting[];
			// 确保导入的端点有唯一ID
			// 遍历所有导入的endpoint，确保每个都有唯一id
			importedEndpointArray.forEach(endpoint => {
				if (!endpoint.id) {
					endpoint.id = this.plugin.generateUniqueId();
				}
			});
			return importedEndpointArray;
		} catch (error) {
			new Notice("Failed to import endpoint: Invalid JSON");
			console.error("Failed to import endpoint:", error);
			return null;
		}
	}

	renderEndpoints(): void {
		// 清除现有端点渲染（保留标题和添加按钮）
		this.containerEl
			.findAll(".endpoint-setting")
			.forEach((el) => el.remove());

		this.plugin.settings.endpoints.forEach((endpoint, index) => {
			const setting = new Setting(this.containerEl)
				.setClass("endpoint-setting") // 添加类以便后续操作
				.addToggle(toggle => toggle
					.setTooltip("Toggle whether to include this endpoint when exporting")
					.setValue(endpoint.willExport)
					.onChange(async (value) => {
						this.plugin.settings.endpoints[index].willExport = value;
						await this.plugin.saveSettings();
					})
				)
				.addText((text) =>{
					text.inputEl.style.width = "100px";
					text
						.setPlaceholder("Endpoint name")
						.setValue(endpoint.name)
						.onChange(async (value: string) => {
							this.plugin.settings.endpoints[index].name = value;
							await this.plugin.saveSettings();
						})
					}
				)
				.addText((text) =>
					text
						.setPlaceholder("https://example.com/api")
						.setValue(endpoint.url)
						.onChange(async (value) => {
							this.plugin.settings.endpoints[index].url = value;
							await this.plugin.saveSettings();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder("apiKey")
						.setValue(endpoint.apiKey)
						.onChange(async (value) => {
							this.plugin.settings.endpoints[index].apiKey =
								value;
							await this.plugin.saveSettings();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder("path")
						.setValue(endpoint.path)
						.onChange(async (value) => {
							this.plugin.settings.endpoints[index].path = value;
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Delete")
						.onClick(async () => {
							this.plugin.settings.endpoints.splice(index, 1);
							await this.plugin.saveSettings();
							this.renderEndpoints(); // 重新渲染
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("copy")
						.setTooltip("Copy")
						.onClick(async () => {
							// 创建一个包含当前endpoint设置的对象副本
							const endpointCopy = {
								...this.plugin.settings.endpoints[index],
							};
							// 移除id属性,因为新复制的endpoint需要新的id
							delete endpointCopy.id;

							// 将endpoint对象放入数组中
							const endpointArray = [endpointCopy];
							// 将endpoint数组转换为JSON字符串
							const endpointJson = JSON.stringify(
								endpointArray,
								null,
								2
							);
							// 复制到系统剪贴板
							navigator.clipboard
								.writeText(endpointJson)
								.then(() => {
									new Notice(
										"Endpoint settings copied to clipboard"
									);
								})
								.catch((err) => {
									new Notice(
										"Failed to copy endpoint settings"
									);
									console.error(
										"Failed to copy endpoint settings:",
										err
									);
								});
							await this.plugin.saveSettings();
							this.renderEndpoints(); // 重新渲染
						});
				});
		});
	}
}

interface AirtableIds {
	baseId: string;
	tableId: string;
	viewId: string;
}

interface RecordFields {
	[key: string]: any;
	Title?: string;
	MD?: string;
	SubFolder?: string;
	UpdatedIn?: number;
}

interface Record {
	fields: RecordFields;
}

class AirtableFetcher {
	private apiKey: string;
	apiUrlRoot: string;
	dataBaseIDs: AirtableIds;
	app: App;
	vault: Vault;

	constructor(private readonly endpoint: EndpointSetting, app: App) {
		this.apiKey = endpoint.apiKey;
		this.app = app;
		this.vault = app.vault;
		this.dataBaseIDs = this.extractAirtableIds(endpoint.url);
		this.apiUrlRoot = `https://api.airtable.com/v0/`;
	}

	extractAirtableIds(url: string): AirtableIds {
		// Regular expression to match Airtable URL pattern
		const regex =
			/https?:\/\/airtable\.com\/(app[^\/]+)\/(tbl[^\/]+)(?:\/(viw[^\/?]+))?/;
		const match = url.match(regex);

		if (!match) {
			return {
				baseId: "",
				tableId: "",
				viewId: "",
			};
		}

		return {
			baseId: match[1] || "",
			tableId: match[2] || "",
			viewId: match[3] || "",
		};
	}

	makeApiUrl(airtableIds: AirtableIds): string {
		return `${this.apiUrlRoot}${airtableIds.baseId}/${airtableIds.tableId}?view=${airtableIds.viewId}`;
	}

	async fetchData() {
		let fields = ["Title", "MD", "SubFolder", "UpdatedIn"];

		let dateFilterOption: DateFilterOption | null = null;
		let dateFilterFormula = "";
		const suggester = new DateFilterSuggester(this.app);
		dateFilterOption = await new Promise<DateFilterOption>((resolve) => {
			suggester.onChooseItem = (item) => {
				resolve(item);
				return item;
			};
			suggester.open();
		});
		if (dateFilterOption && dateFilterOption.value !== 99) {
			const formula = `{UpdatedIn} <= ${dateFilterOption.value}`;
			dateFilterFormula = `&filterByFormula=${encodeURIComponent(
				formula
			)}`;
		}
		let url = `${this.makeApiUrl(this.dataBaseIDs)}
			&${fields.map((f) => `fields%5B%5D=${encodeURIComponent(f)}`).join("&")}
			${dateFilterFormula}
			&offset=
		`;

		let records = await this.getAllRecordsFromTable(url);
		return records;
	}

	async createOrUpdateNotesInOBFromSourceTable(
		endpoint: EndpointSetting
	): Promise<void> {
		const directoryRootPath = endpoint.path;

		let notesToCreateOrUpdate: RecordFields[] = (
			await this.fetchData()
		).map((note: Record) => note.fields);

		console.dir(notesToCreateOrUpdate);

		new Notice(
			`There are ${notesToCreateOrUpdate.length} files needed to be updated or created.`
		);

		let configDirModified = 0;

		while (notesToCreateOrUpdate.length > 0) {
			let toDealNotes = notesToCreateOrUpdate.slice(0, 10);
			for (let note of toDealNotes) {
				let validFileName = this.convertToValidFileName(
					note.Title || ""
				);
				let folderPath =
					directoryRootPath +
					(note.SubFolder ? `/${note.SubFolder}` : "");
				await this.createPathIfNeeded(folderPath);
				const noteExtension =
					"Extension" in note ? note.Extension : "md";
				const notePath = `${folderPath}/${validFileName}.${noteExtension}`;
				const noteExists = await this.vault.adapter.exists(notePath);
				let noteContent = note.MD ? note.MD : "";
				if (!noteExists) {
					await this.vault.create(notePath, noteContent);
				} else if (noteExists && notePath.startsWith(".")) {
					await this.vault.adapter
						.write(notePath, noteContent)
						.catch((r: any) => {
							new Notice("Failed to write file: " + r);
						});
					configDirModified++;
				} else {
					let file = this.app.vault.getFileByPath(notePath);
					if (file) {
						await this.vault.modify(file, noteContent);
						await new Promise((r) => setTimeout(r, 100)); // 等待元数据更新
					}
				}
			}

			notesToCreateOrUpdate = notesToCreateOrUpdate.slice(10);
			if (notesToCreateOrUpdate.length) {
				new Notice(
					`There are ${notesToCreateOrUpdate.length} files needed to be processed.`
				);
			} else {
				new Notice("All Finished.");
			}
		}
	}

	convertToValidFileName(fileName: string): string {
		return fileName.replace(/[\/|\\:'"()（）{}<>\.\*]/g, "-").trim();
	}

	async createPathIfNeeded(folderPath: string): Promise<void> {
		const directoryExists = await this.vault.adapter.exists(folderPath);
		if (!directoryExists) {
			await this.vault.createFolder(normalizePath(folderPath));
		}
	}

	async getAllRecordsFromTable(url: string): Promise<any> {
		let records: any[] = [];
		let offset = "";

		do {
			try {
				// 使用 fetch 替换 requestUrl
				const response = await fetch(url + offset, {
					method: "GET",
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
					},
				});
				// fetch 返回的是 Response 对象，需要调用 .json() 获取数据
				const responseData = await response.json();
				// 为了兼容后续代码，将 responseData 包装成与 requestUrl 返回结构一致
				const responseObj = { json: responseData };

				const data = responseObj.json;
				records = records.concat(data.records);
				new Notice(`Got ${records.length} records`);

				offset = data.offset || "";
			} catch (error) {
				console.dir(error);
			}
		} while (offset !== "");

		return records;
	}
}

interface DateFilterOption {
	id: string;
	name: string;
	value: number;
}

class DateFilterSuggester extends FuzzySuggestModal<DateFilterOption> {
	private options: DateFilterOption[] = [
		{ id: "day", name: "Help documents updated today", value: 1 },
		{
			id: "week",
			name: "Help documents updated in the past week",
			value: 7,
		},
		{
			id: "twoWeeks",
			name: "Help documents updated in the past two weeks",
			value: 14,
		},
		{
			id: "month",
			name: "Help documents updated in the past month",
			value: 30,
		},
		{ id: "all", name: "All help documents", value: 99 },
	];

	getItems(): DateFilterOption[] {
		return this.options;
	}

	getItemText(item: DateFilterOption): string {
		return item.name;
	}

	onChooseItem(
		item: DateFilterOption,
		evt: MouseEvent | KeyboardEvent
	): DateFilterOption {
		return item;
	}

	renderSuggestion(
		item: FuzzyMatch<DateFilterOption>,
		el: HTMLElement
	): void {
		el.createEl("div", { text: item.item.name, cls: "suggester-title" });
	}
}
