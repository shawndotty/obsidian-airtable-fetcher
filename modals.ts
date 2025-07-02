import { Modal, Setting } from "obsidian";
import { t } from "./lang/helpers";
import { FetchSourceSetting } from "./types";
import { setIcon } from "obsidian";

export class FetchSourceEditModal extends Modal {
	private fetchSource: FetchSourceSetting;
	private onSave: (fetchSource: FetchSourceSetting) => void;

	constructor(
		app: any,
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
