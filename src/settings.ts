import {
	App,
	PluginSettingTab,
	Setting,
	setIcon,
	Modal,
	Notice,
} from "obsidian";
import { t } from "../lang/helpers";
import { encodeBase64, decodeBase64 } from "./utils";
import { FetchSourceSetting } from "./types";
import { FetchSourceEditModal } from "./modals";
import ObAirtableFetcher from "../main";

// FetchSourceSettingsTab 类从 main.ts 移动至此，并导出
export class FetchSourceSettingsTab extends PluginSettingTab {
	plugin: ObAirtableFetcher;
	constructor(app: App, plugin: any) {
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
								(fetchSource: FetchSourceSetting) => {
									// 创建fetchSource的副本并移除id
									const fetchSourceCopy = { ...fetchSource };
									delete fetchSourceCopy.id;
									// 导出时apiKey进行base64编码
									if (fetchSourceCopy.apiKey) {
										fetchSourceCopy.apiKey = encodeBase64(
											fetchSourceCopy.apiKey
										);
									}
									return fetchSourceCopy;
								}
							);

						// 筛选出willExport为true的获取源
						const fetchSourcesToExportFiltered =
							fetchSourcesToExport.filter(
								(fetchSource: FetchSourceSetting) =>
									fetchSource.willExport
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
				// 导入时对apiKey进行base64解码
				if (fetchSource.apiKey) {
					fetchSource.apiKey = decodeBase64(fetchSource.apiKey);
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

		this.plugin.settings.fetchSources.forEach(
			(fetchSource: FetchSourceSetting, index: number) => {
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
					// 复制时apiKey进行base64编码
					if (fetchSourceCopy.apiKey) {
						fetchSourceCopy.apiKey = encodeBase64(
							fetchSourceCopy.apiKey
						);
					}

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
							new Notice(
								t("Failed to copy fetch source settings")
							);
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
			}
		);
	}

	// 打开编辑模态框
	private openEditModal(fetchSource: FetchSourceSetting, index: number) {
		const modal = new FetchSourceEditModal(
			this.app,
			fetchSource,
			async (updatedFetchSource: FetchSourceSetting) => {
				this.plugin.settings.fetchSources[index] = updatedFetchSource;
				await this.plugin.saveSettings();
				this.renderFetchSources(); // 重新渲染
				this.plugin.refreshCommands(); // 刷新命令
			}
		);
		modal.open();
	}
}
