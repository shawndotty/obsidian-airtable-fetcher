# Obsidian Airtable Fetcher

Obsidian Airtable Fetcher is a powerful plugin for [Obsidian](https://obsidian.md) that allows you to connect to your [Airtable](https://airtable.com/) bases, fetch data, and seamlessly create or update notes within your vault. It's the perfect tool for syncing content like project tasks, CRM contacts, research data, or any structured information you manage in Airtable.

## Features

- **Multiple Fetch Sources**: Configure connections to different Airtable bases, tables, or views.
- **Command Palette Integration**: Each fetch source gets its own command for quick and easy data fetching.
- **Smart Syncing**: Choose to fetch all notes or only those updated within a specific timeframe (e.g., last day, week, month).
- **Flexible Note Organization**: Automatically save notes to designated folders and even create subfolders based on your Airtable data.
- **Easy Configuration**: A user-friendly settings interface to add, edit, delete, and manage your fetch sources.
- **Import/Export**: Easily back up, share, and import fetch source configurations in JSON format.
- **Secure**: Your API keys are stored securely and are hidden in the interface.
- **Multi-language Support**: Available in English, Simplified Chinese, and Traditional Chinese.

## How It Works

The plugin operates based on "Fetch Sources". Each source is a saved configuration that points to a specific Airtable view. When you trigger a fetch, the plugin connects to the Airtable API, retrieves records from your specified view, and then creates or updates `.md` files in your Obsidian vault.

### Required Airtable Table Structure

To use this plugin, your Airtable table must contain a few specific fields. The plugin looks for these fields by name to correctly create the notes.

| Field Name  | Field Type         | Required | Description                                                                                                                            |
| :---------- | :----------------- | :------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Title`     | Single line text   | **Yes**  | The value in this field will become the filename and title of your Obsidian note.                                                                      |
| `MD`        | Long text          | **Yes**  | The content for your Obsidian note. You can enable Markdown formatting for this field within Airtable.                                                 |
| `SubFolder` | Single line text   | No       | (Optional) If you want to organize notes into subfolders, specify the subfolder path here (e.g., `Project A/Tasks`).                                    |
| `UpdatedIn` | Formula (Number)   | **Yes**  | A formula that calculates the number of days since the record was last modified. This is crucial for the "smart sync" feature. See formula below. |

**`UpdatedIn` Field Formula:**

You must create a formula field named `UpdatedIn` and use the following Airtable formula. This allows the plugin to fetch only the records that have changed recently.

```
DATETIME_DIFF(TODAY(), LAST_MODIFIED_TIME(), 'days')
```

## Getting Started

Follow these steps to set up your first connection between Obsidian and Airtable.

### Step 1: Install the Plugin

Install the "Airtable Fetcher" plugin from the Obsidian Community Plugins browser.

### Step 2: Get Your Airtable Information

1.  **Airtable URL**:
    - Open your Airtable base and navigate to the specific **View** you want to fetch data from.
    - Copy the entire URL from your browser's address bar. It should look something like this: `https://airtable.com/appXXXXXXXXXXXXXX/tblXXXXXXXXXXXXXX/viwXXXXXXXXXXXXXX`

2.  **Airtable API Key (Personal Access Token)**:
    - Go to your Airtable [Developer Hub](https://airtable.com/create/tokens).
    - Click **+ Create new token**.
    - Give your token a name (e.g., "Obsidian Fetcher").
    - For **Scopes**, you must add `data.records:read`.
    - For **Access**, select the base(s) you want to grant access to.
    - Click **Create token** and copy the generated token key.

### Step 3: Configure a Fetch Source

1.  Open Obsidian **Settings**.
2.  Go to **Community Plugins** > **Airtable Fetcher**.
3.  Click **+ Add New Fetch Source**. A card will appear for you to edit. Click the **Pencil Icon** to open the edit modal.
4.  Fill in the details:
    - **Fetch Source Name**: A descriptive name for this connection (e.g., "Project Tracker"). This name will appear in the command palette.
    - **Fetch Source URL**: Paste the Airtable view URL you copied earlier.
    - **API Key**: Paste your Airtable Personal Access Token.
    - **Target Path**: Specify the folder in your vault where the notes should be saved (e.g., `data/projects`). The plugin will create this folder if it doesn't exist.
5.  Click **Save**.

## Usage

### Fetching Data

1.  Open the **Command Palette** ( `Ctrl+P` or `Cmd+P`).
2.  Type `Fetch` followed by the name of your source (e.g., `Fetch Project Tracker`).
3.  Select the command from the list.
4.  A new dialog will appear asking you to select a time frame. You can choose to fetch all notes or only notes updated recently.
5.  The plugin will fetch the data from Airtable and create/update the notes in your specified target path. You will see notices indicating the progress.

### Managing Fetch Sources

The settings page provides a card-based view of all your fetch sources.

- **Edit**: Click the **pencil icon** to modify a source's details.
- **Delete**: Click the **trash can icon** to remove a source.
- **Copy**: Click the **copy icon** to copy a single source's configuration (in JSON format) to your clipboard. This is useful for duplicating a source.
- **Export/Import**:
    - **Export**: Use the **Export All Fetch Sources** button to copy the configurations for all sources marked with the "Export" toggle.
    - **Import**: Use the **Import New Fetch Sources** button to paste a JSON configuration and add one or more sources in bulk.