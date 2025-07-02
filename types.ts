// 类型定义文件，供 main.ts 等其他文件导入使用

export interface FetchSourceSetting {
	name: string;
	url: string;
	apiKey: string;
	path: string;
	id?: string;
	willExport: boolean;
}

export interface ObDBFetcherSettings {
	fetchSources: FetchSourceSetting[];
}

export interface AirtableIds {
	baseId: string;
	tableId: string;
	viewId: string;
}

export interface RecordFields {
	[key: string]: any;
	Title?: string;
	MD?: string;
	SubFolder?: string;
	UpdatedIn?: number;
}

export interface Record {
	fields: RecordFields;
}

export interface DateFilterOption {
	id: string;
	name: string;
	value: number;
}
