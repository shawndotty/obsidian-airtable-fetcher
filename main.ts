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
	setIcon,
} from "obsidian";

import { t } from "./lang/helpers";

// 扩展 App 类型以包含 commands 属性
declare module "obsidian" {
	interface App {
		commands: {
			removeCommand(id: string): void;
		};
	}
}

// Remember to rename these classes and interfaces!

// 单个获取源设置项
interface FetchSourceSetting {
	name: string;
	url: string;
	apiKey: string;
	path: string;
	id?: string;
	willExport: boolean;
}

// 插件整体设置
interface ObDBFetcherSettings {
	fetchSources: FetchSourceSetting[];
}

const DEFAULT_SETTINGS: ObDBFetcherSettings = {
	fetchSources: [
		{
			name: t("Untitled"),
			url: "https://example.com",
			apiKey: "",
			path: "",
			willExport: true,
		},
	],
};

export default class ObDBFetcher extends Plugin {
	settings: ObDBFetcherSettings;
	private commandIds: Set<string> = new Set(); // 跟踪已注册的命令ID

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new FetchSourceSettingsTab(this.app, this));
		// 初始注册命令
		this.registerFetchSourceCommands();
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// 确保每个fetchSource都有唯一ID
		this.settings.fetchSources.forEach((fetchSource) => {
			if (!fetchSource.id) {
				fetchSource.id = this.generateUniqueId();
			}
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// 生成唯一ID（使用时间戳+随机数）
	generateUniqueId(): string {
		return `fetch-source-${Date.now()}-${Math.floor(
			Math.random() * 10000
		)}`;
	}

	// 注册所有获取源命令
	private registerFetchSourceCommands() {
		// 先移除所有旧命令
		this.unregisterAllCommands();

		this.settings.fetchSources.forEach((fetchSource) => {
			const commandId = `open-${fetchSource.id}`;

			this.addCommand({
				id: commandId,
				name: t("Fetch {{name}}", { name: fetchSource.name }),
				callback: async () => {
					// 实际执行操作 - 这里示例为打开URL

					await new AirtableFetcher(
						fetchSource,
						this.app
					).createOrUpdateNotesInOBFromSourceTable(fetchSource);

					new Notice(`${fetchSource.name} is done.`);
				},
			});

			// 记录已注册的命令ID
			this.commandIds.add(commandId);
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
		this.registerFetchSourceCommands();
	}
}

class FetchSourceSettingsTab extends PluginSettingTab {
	plugin: ObDBFetcher;

	constructor(app: App, plugin: ObDBFetcher) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 标题
		containerEl.createEl("h2", {
			text: t("Airtable Fetch Sources Configuration"),
		});

		// 创建按钮容器
		const buttonContainer = containerEl.createDiv({
			cls: "top-button-container",
		});

		// 在同一行添加三个按钮
		new Setting(buttonContainer)
			.addButton((button) =>
				button
					.setButtonText(t("+ Add New Fetch Source"))
					.setCta()
					.onClick(() => {
						this.plugin.settings.fetchSources.push({
							name: "",
							url: "",
							apiKey: "",
							path: "",
							willExport: true,
							id: this.plugin.generateUniqueId(), // 生成新ID
						});
						this.plugin.saveSettings();
						this.renderFetchSources(); // 重新渲染
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("Import New Fetch Sources"))
					.setCta()
					.onClick(async () => {
						const importedFetchSources =
							await this.importFetchSources();
						if (importedFetchSources?.length) {
							this.plugin.settings.fetchSources.push(
								...importedFetchSources
							);
							await this.plugin.saveSettings();
							this.renderFetchSources(); // 重新渲染
						}
					})
			)
			.addButton((button) =>
				button
					.setButtonText(t("Export All Fetch Sources"))
					.setCta()
					.onClick(async () => {
						// 导出所有fetchSources设置
						const fetchSourcesToExport =
							this.plugin.settings.fetchSources.map(
								(fetchSource) => {
									// 创建fetchSource的副本并移除id
									const fetchSourceCopy = { ...fetchSource };
									delete fetchSourceCopy.id;
									return fetchSourceCopy;
								}
							);

						// 筛选出willExport为true的获取源
						const fetchSourcesToExportFiltered =
							fetchSourcesToExport.filter(
								(fetchSource) => fetchSource.willExport
							);

						// 转换为JSON字符串
						const fetchSourcesJson = JSON.stringify(
							fetchSourcesToExportFiltered,
							null,
							2
						);

						// 复制到剪贴板
						try {
							await navigator.clipboard.writeText(
								fetchSourcesJson
							);
							new Notice(
								t(
									"All fetch source settings exported to clipboard"
								)
							);
						} catch (err) {
							new Notice(
								t("Failed to export fetch source settings")
							);
							console.error(
								t("Failed to export fetch source settings:"),
								err
							);
						}
					})
			);

		// 渲染所有获取源设置项
		this.renderFetchSources();
	}

	// 导入新获取源的方法
	private async importFetchSources(): Promise<FetchSourceSetting[] | null> {
		// 创建一个模态框用于多行文本输入
		const modal = new Modal(this.app);
		modal.titleEl.setText(t("Import Fetch Sources"));
		const { contentEl } = modal;

		// 创建文本区域
		const textArea = contentEl.createEl("textarea", {
			attr: {
				rows: "10",
				placeholder: t(
					"Please paste the fetch source configuration JSON"
				),
			},
			cls: "full-width-textarea",
		});

		// 添加CSS样式使textarea宽度100%
		textArea.style.width = "100%";
		textArea.style.boxSizing = "border-box";

		// 创建确认按钮
		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container",
		});

		let fetchSourceJsonArray = "";

		// 添加确认按钮
		// 创建确认按钮
		buttonContainer
			.createEl("button", {
				text: t("Confirm"),
				cls: "mod-cta",
			})
			.addEventListener("click", () => {
				fetchSourceJsonArray = textArea.value;
				modal.close();
			});

		// 创建取消按钮
		buttonContainer
			.createEl("button", {
				text: t("Cancel"),
			})
			.addEventListener("click", () => {
				fetchSourceJsonArray = "";
				modal.close();
			});

		// 打开模态框并等待用户输入
		await new Promise((resolve) => {
			modal.onClose = () => resolve(void 0);
			modal.open();
		});
		if (!fetchSourceJsonArray) {
			return null;
		}
		try {
			const importedFetchSourceArray = JSON.parse(
				fetchSourceJsonArray
			) as FetchSourceSetting[];
			// 确保导入的获取源有唯一ID
			// 遍历所有导入的fetchSource，确保每个都有唯一id
			importedFetchSourceArray.forEach((fetchSource) => {
				if (!fetchSource.id) {
					fetchSource.id = this.plugin.generateUniqueId();
				}
			});
			return importedFetchSourceArray;
		} catch (error) {
			new Notice(t("Failed to import fetch sources: Invalid JSON"));
			console.error(t("Failed to import fetch sources:"), error);
			return null;
		}
	}

	renderFetchSources(): void {
		// 清除现有获取源渲染（保留标题和添加按钮）
		// 移除所有旧的卡片容器和卡片
		this.containerEl
			.findAll(".fetch-source-cards-container")
			.forEach((el) => el.remove());
		this.containerEl
			.findAll(".fetch-source-card")
			.forEach((el) => el.remove());

		// 清理可能存在的空行或多余元素
		this.containerEl.querySelectorAll("div").forEach((el) => {
			if (el.children.length === 0 && el.textContent?.trim() === "") {
				el.remove();
			}
		});

		// 创建获取源卡片容器
		const cardsContainer = this.containerEl.createEl("div", {
			cls: "fetch-source-cards-container",
		});

		this.plugin.settings.fetchSources.forEach((fetchSource, index) => {
			// 创建卡片容器
			const card = cardsContainer.createEl("div", {
				cls: "fetch-source-card",
			});

			// 卡片头部 - 包含名称和操作按钮
			const cardHeader = card.createEl("div", {
				cls: "fetch-source-card-header",
			});

			// 获取源名称
			cardHeader.createEl("h3", {
				text: fetchSource.name || t("Unnamed Fetch Source"),
				cls: "fetch-source-name",
			});

			// 操作按钮容器
			const actionsContainer = cardHeader.createEl("div", {
				cls: "fetch-source-actions",
			});

			// Export Toggle
			const toggleContainer = actionsContainer.createEl("div", {
				cls: "fetch-source-toggle",
			});
			toggleContainer.createEl("span", {
				text: t("Export"),
				cls: "toggle-label",
			});
			const toggle = toggleContainer.createEl("input", {
				type: "checkbox",
				cls: "fetch-source-toggle-input",
			}) as HTMLInputElement;
			toggle.checked = fetchSource.willExport;
			toggle.addEventListener("change", async (e) => {
				const target = e.target as HTMLInputElement;
				this.plugin.settings.fetchSources[index].willExport =
					target.checked;
				await this.plugin.saveSettings();
			});

			// 编辑按钮
			const editBtn = actionsContainer.createEl("button", {
				cls: "fetch-source-action-btn edit-btn",
				attr: {
					"aria-label": t("Edit fetch source"),
				},
			});
			setIcon(editBtn, "pencil");
			editBtn.addEventListener("click", () => {
				this.openEditModal(fetchSource, index);
			});

			// 复制按钮
			const copyBtn = actionsContainer.createEl("button", {
				cls: "fetch-source-action-btn copy-btn",
				attr: {
					"aria-label": t("Copy fetch source settings"),
				},
			});
			setIcon(copyBtn, "copy");
			copyBtn.addEventListener("click", async () => {
				// 创建一个包含当前fetchSource设置的对象副本
				const fetchSourceCopy = {
					...this.plugin.settings.fetchSources[index],
				};
				// 移除id属性,因为新复制的fetchSource需要新的id
				delete fetchSourceCopy.id;

				// 将fetchSource对象放入数组中
				const fetchSourceArray = [fetchSourceCopy];
				// 将fetchSource数组转换为JSON字符串
				const fetchSourceJson = JSON.stringify(
					fetchSourceArray,
					null,
					2
				);
				// 复制到系统剪贴板
				navigator.clipboard
					.writeText(fetchSourceJson)
					.then(() => {
						new Notice(
							t("Fetch source settings copied to clipboard")
						);
					})
					.catch((err) => {
						new Notice(t("Failed to copy fetch source settings"));
						console.error(
							t("Failed to copy fetch source settings:"),
							err
						);
					});
			});

			// 删除按钮
			const deleteBtn = actionsContainer.createEl("button", {
				cls: "fetch-source-action-btn delete-btn",
				attr: {
					"aria-label": t("Delete fetch source"),
				},
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", async () => {
				this.plugin.settings.fetchSources.splice(index, 1);
				await this.plugin.saveSettings();
				this.renderFetchSources(); // 重新渲染
				this.plugin.refreshCommands(); // 刷新命令
			});

			// 卡片内容 - 显示获取源信息摘要
			const cardContent = card.createEl("div", {
				cls: "fetch-source-card-content",
			});

			// URL信息
			if (fetchSource.url) {
				const urlEl = cardContent.createEl("div", {
					cls: "fetch-source-info",
				});
				urlEl.createEl("span", {
					text: t("URL: "),
					cls: "info-label",
				});
				urlEl.createEl("span", {
					text: fetchSource.url,
					cls: "info-value",
				});
			}

			// Path信息
			if (fetchSource.path) {
				const pathEl = cardContent.createEl("div", {
					cls: "fetch-source-info",
				});
				pathEl.createEl("span", {
					text: t("Path: "),
					cls: "info-label",
				});
				pathEl.createEl("span", {
					text: fetchSource.path,
					cls: "info-value",
				});
			}

			// API Key信息（显示为星号）
			if (fetchSource.apiKey) {
				const keyEl = cardContent.createEl("div", {
					cls: "fetch-source-info",
				});
				keyEl.createEl("span", {
					text: t("API Key: "),
					cls: "info-label",
				});
				keyEl.createEl("span", {
					text: t("••••••••"),
					cls: "info-value",
				});
			}
		});

		// 添加CSS样式
		this.addCardStyles();
	}

	// 打开编辑模态框
	private openEditModal(fetchSource: FetchSourceSetting, index: number) {
		const modal = new FetchSourceEditModal(
			this.app,
			fetchSource,
			async (updatedFetchSource) => {
				// 更新获取源设置
				this.plugin.settings.fetchSources[index] = updatedFetchSource;
				await this.plugin.saveSettings();
				this.renderFetchSources(); // 重新渲染
				this.plugin.refreshCommands(); // 刷新命令
			}
		);
		modal.open();
	}

	// 添加卡片样式
	private addCardStyles() {
		// 检查是否已经添加了样式
		if (document.getElementById("fetch-source-cards-styles")) {
			return;
		}

		const style = document.createElement("style");
		style.id = "fetch-source-cards-styles";
		style.textContent = `
			.top-button-container .setting-item-info {
				display: none;
			}

			.fetch-source-cards-container {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
				gap: 16px;
				margin-top: 16px;
				margin-bottom: 0;
				padding: 0;
			}

			.fetch-source-card {
				border: 1px solid var(--background-modifier-border);
				border-radius: 8px;
				padding: 16px;
				background: var(--background-primary);
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				transition: box-shadow 0.2s ease;
				margin: 0;
			}

			.fetch-source-card:hover {
				box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
			}

			.fetch-source-card-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 12px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--background-modifier-border);
			}

			.fetch-source-name {
				margin: 0;
				font-size: 16px;
				font-weight: 600;
				color: var(--text-normal);
				flex: 1;
			}

			.fetch-source-actions {
				display: flex;
				align-items: center;
				gap: 8px;
			}

			.fetch-source-toggle {
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.toggle-label {
				font-size: 12px;
				color: var(--text-muted);
			}

			.fetch-source-toggle-input {
				margin: 0;
			}

			.fetch-source-action-btn {
				background: none;
				border: none;
				padding: 4px;
				border-radius: 4px;
				cursor: pointer;
				font-size: 14px;
				transition: background-color 0.2s ease;
			}

			.fetch-source-action-btn:hover {
				background-color: var(--background-modifier-hover);
			}

			.edit-btn:hover {
				background-color: var(--interactive-accent-hover);
			}


			.copy-btn:hover {
				background-color: var(--interactive-success-hover);
			}

			.delete-btn:hover {
				background-color: var(--interactive-danger-hover);
			}

			.fetch-source-card-content {
				display: flex;
				flex-direction: column;
				gap: 8px;
				margin: 0;
			}

			.fetch-source-info {
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 13px;
				margin: 0;
			}

			.info-label {
				color: var(--text-muted);
				font-weight: 500;
				min-width: 60px;
			}

			.info-value {
				color: var(--text-normal);
				word-break: break-all;
			}

			/* 编辑模态框样式 */
			.fetch-source-edit-modal .modal-content {
				padding: 20px;
				width: 600px; /* Set a fixed width for the modal content */
			}

			/* Use CSS Grid for alignment */
			.fetch-source-edit-modal .setting-item {
				display: grid;
				grid-template-columns: 200px 1fr; /* Fixed width label, flexible control */
				align-items: center; /* Vertically align items */
				margin-bottom: 16px;
				gap: 16px; /* Add space between label and control */
			}

			/* Ensure text inputs take full width of their container */
			.fetch-source-edit-modal .setting-item-control input[type="text"],
			.fetch-source-edit-modal .setting-item-control input[type="password"] {
				width: 100%;
				box-sizing: border-box;
			}

			.fetch-source-edit-modal .modal-button-container {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
				margin-top: 20px;
			}

			/* Top button container styles */
			.top-button-container {
				display: flex;
				gap: 16px;
				margin-bottom: 16px;
			}

			.top-button-container .setting-item {
				flex: 1;
				display: flex;
				margin-bottom: 0; /* Override default margin */
			}

			.top-button-container .setting-item-control button {
				width: 100%;
				margin: 0;
			}

			/* Styles for API Key visibility toggle */
			.api-key-container {
				position: relative;
			}

			.api-key-container input[type="password"],
			.api-key-container input[type="text"] {
				/* Space for the icon button */
				padding-right: 36px;
			}

			.visibility-toggle-btn {
				position: absolute;
				right: 0;
				top: 0;
				bottom: 0;
				border: none;
				background: transparent;
				padding: 0 8px;
				cursor: pointer;
				color: var(--text-muted);
			}

			.visibility-toggle-btn:hover {
				color: var(--text-normal);
			}
		`;
		document.head.appendChild(style);
	}
}

// 获取源编辑模态框
class FetchSourceEditModal extends Modal {
	private fetchSource: FetchSourceSetting;
	private onSave: (fetchSource: FetchSourceSetting) => void;

	constructor(
		app: App,
		fetchSource: FetchSourceSetting,
		onSave: (fetchSource: FetchSourceSetting) => void
	) {
		super(app);
		this.fetchSource = { ...fetchSource }; // 创建副本
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("fetch-source-edit-modal");

		// 设置标题
		this.titleEl.setText(t("Edit Fetch Source"));

		// 创建表单
		this.createForm(contentEl);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private createForm(container: HTMLElement) {
		// 名称设置
		new Setting(container)
			.setName(t("Fetch Source Name"))
			.setDesc(t("A descriptive name for this fetch source"))
			.addText((text) =>
				text
					.setPlaceholder(t("Enter fetch source name"))
					.setValue(this.fetchSource.name)
					.onChange((value) => {
						this.fetchSource.name = value;
					})
			);

		// URL设置
		new Setting(container)
			.setName(t("Fetch Source URL"))
			.setDesc(t("The Airtable URL For This Fetch Source"))
			.addText((text) =>
				text
					.setPlaceholder(t("https://airtable.com/app..."))
					.setValue(this.fetchSource.url)
					.onChange((value) => {
						this.fetchSource.url = value;
					})
			);

		// API Key设置
		new Setting(container)
			.setName(t("API Key"))
			.setDesc(t("Your Airtable API key"))
			.addText((text) => {
				// Set initial type to password for security
				text.inputEl.type = "password";

				text.setPlaceholder(t("Enter your API key"))
					.setValue(this.fetchSource.apiKey)
					.onChange((value) => {
						this.fetchSource.apiKey = value;
					});

				// Add a container for relative positioning
				const container = text.inputEl.parentElement;
				if (container) {
					container.addClass("api-key-container");

					// Create the visibility toggle button
					const visibilityBtn = container.createEl("button", {
						cls: "visibility-toggle-btn",
						attr: {
							"aria-label": t("Toggle API key visibility"),
						},
					});

					// Initial state: key is hidden, show 'eye-off' icon
					setIcon(visibilityBtn, "eye-off");
					let isVisible = false;

					visibilityBtn.addEventListener("click", (e) => {
						e.preventDefault();
						isVisible = !isVisible;
						if (isVisible) {
							// If key is now visible, show 'eye' icon
							text.inputEl.type = "text";
							setIcon(visibilityBtn, "eye");
						} else {
							// If key is now hidden, show 'eye-off' icon
							text.inputEl.type = "password";
							setIcon(visibilityBtn, "eye-off");
						}
					});
				}
			});

		// Path设置
		new Setting(container)
			.setName(t("Target Path"))
			.setDesc(t("The folder path where notes will be created"))
			.addText((text) =>
				text
					.setPlaceholder(t("e.g., My Notes/Airtable"))
					.setValue(this.fetchSource.path)
					.onChange((value) => {
						this.fetchSource.path = value;
					})
			);

		// Export Toggle
		new Setting(container)
			.setName(t("Include in Export"))
			.setDesc(t("Whether to include this fetch source when exporting"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.fetchSource.willExport)
					.onChange((value) => {
						this.fetchSource.willExport = value;
					})
			);

		// 按钮容器
		const buttonContainer = container.createEl("div", {
			cls: "modal-button-container",
		});

		// 保存按钮
		buttonContainer
			.createEl("button", {
				text: t("Save"),
				cls: "mod-cta",
			})
			.addEventListener("click", () => {
				this.onSave(this.fetchSource);
				this.close();
			});

		// 取消按钮
		buttonContainer
			.createEl("button", {
				text: t("Cancel"),
			})
			.addEventListener("click", () => {
				this.close();
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

	constructor(private readonly fetchSource: FetchSourceSetting, app: App) {
		this.apiKey = fetchSource.apiKey;
		this.app = app;
		this.vault = app.vault;
		this.dataBaseIDs = this.extractAirtableIds(fetchSource.url);
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
		fetchSource: FetchSourceSetting
	): Promise<void> {
		const directoryRootPath = fetchSource.path;

		let notesToCreateOrUpdate: RecordFields[] = (
			await this.fetchData()
		).map((note: Record) => note.fields);

		console.dir(notesToCreateOrUpdate);

		new Notice(
			t("There are {{count}} files needed to be updated or created.", {
				count: notesToCreateOrUpdate.length.toString(),
			})
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
							new Notice(
								t("Failed to write file: {{error}}", {
									error: r,
								})
							);
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
					t("There are {{count}} files needed to be processed.", {
						count: notesToCreateOrUpdate.length.toString(),
					})
				);
			} else {
				new Notice(t("All Finished."));
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
				new Notice(
					t("Got {{count}} records", {
						count: records.length.toString(),
					})
				);

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
		{ id: "day", name: t("Notes updated today"), value: 1 },
		{
			id: "week",
			name: t("Notes updated in the past week"),
			value: 7,
		},
		{
			id: "twoWeeks",
			name: t("Notes updated in the past two weeks"),
			value: 14,
		},
		{
			id: "month",
			name: t("Notes updated in the past month"),
			value: 30,
		},
		{ id: "all", name: t("All notes"), value: 99 },
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
