import { App, Vault, Notice, normalizePath } from "obsidian";
import { t } from "../lang/helpers";
import {
	FetchSourceSetting,
	AirtableIds,
	RecordFields,
	Record,
	DateFilterOption,
} from "./types";
import { DateFilterSuggester } from "./suggesters";

export class AirtableFetcher {
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
		const regex =
			/https?:\/\/airtable\.com\/(app[^\/]+)\/(tbl[^\/]+)(?:\/(viw[^\/?]+))?/;
		const match = url.match(regex);
		if (!match) {
			return { baseId: "", tableId: "", viewId: "" };
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
		let url = `${this.makeApiUrl(this.dataBaseIDs)}&${fields
			.map((f) => `fields%5B%5D=${encodeURIComponent(f)}`)
			.join("&")}${dateFilterFormula}&offset=`;
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
						await new Promise((r) => setTimeout(r, 100));
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
				const response = await fetch(url + offset, {
					method: "GET",
					headers: { Authorization: `Bearer ${this.apiKey}` },
				});
				const responseData = await response.json();
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
