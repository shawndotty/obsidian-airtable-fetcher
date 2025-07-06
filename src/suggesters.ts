import { FuzzySuggestModal, FuzzyMatch } from "obsidian";
import { DateFilterOption } from "./types";
import { t } from "./lang/helpers";

// 通用 Suggester 基类
export abstract class BaseSuggester<T> extends FuzzySuggestModal<T> {
	protected options: T[];
	private getText: (item: T) => string;

	constructor(app: any, options: T[], getItemText: (item: T) => string) {
		super(app);
		this.options = options;
		this.getText = getItemText;
	}

	getItems(): T[] {
		return this.options;
	}

	getItemText(item: T): string {
		return this.getText(item);
	}

	renderSuggestion(item: FuzzyMatch<T>, el: HTMLElement): void {
		el.createEl("div", {
			text: this.getText(item.item),
			cls: "suggester-title",
		});
	}

	abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): T;
}

export class DateFilterSuggester extends BaseSuggester<DateFilterOption> {
	constructor(app: any) {
		super(
			app,
			[
				{ id: "day", name: `1. ${t("Notes updated today")}`, value: 1 },
				{
					id: "threeDays",
					name: `2. ${t("Notes updated in the pas 3 days")}`,
					value: 3,
				},
				{
					id: "week",
					name: `3. ${t("Notes updated in the past week")}`,
					value: 7,
				},
				{
					id: "twoWeeks",
					name: `4. ${t("Notes updated in the past two weeks")}`,
					value: 14,
				},
				{
					id: "month",
					name: `5. ${t("Notes updated in the past month")}`,
					value: 30,
				},
				{ id: "all", name: `6. ${t("All notes")}`, value: 9999 },
			],
			(item) => item.name
		);
	}

	onChooseItem(
		item: DateFilterOption,
		_evt: MouseEvent | KeyboardEvent
	): DateFilterOption {
		return item;
	}
}
