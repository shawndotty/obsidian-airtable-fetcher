[English](README.md)

# Obsidian Airtable Fetcher (Airtable 数据抓取插件)

Obsidian Airtable Fetcher 是一款功能简单的 [Obsidian](https://obsidian.md) 插件，它允许您连接到您的 [Airtable](https://airtable.com/) 数据库 (base)，抓取数据，并无缝地在您的 Obsidian 仓库 (vault) 中创建或更新笔记。对于同步项目任务、CRM 联系人、研究数据或您在 Airtable 中管理的任何结构化信息，它都能成为你的有力助手。

## 功能特性

-   **多重抓取源**: 可配置连接到不同的 Airtable 数据基地、表格或视图。
-   **命令面板集成**: 每个抓取源都有自己的命令，方便快速抓取数据，也方便你为它们配置单独的快捷键。
-   **智能同步**: 可选择抓取所有笔记，或仅抓取在特定时间范围内（如最近一天、一周、一月）更新过的笔记。
-   **灵活的笔记组织**: 自动将笔记保存到指定文件夹，也可以根据您的 Airtable 数据创建子文件夹。
-   **简易配置**: 用户友好的设置界面，用于添加、编辑、删除和管理您的抓取源。
-   **导入/导出**: 以 JSON 格式轻松备份、分享和导入抓取源配置。
-   **多语言支持**: 提供英语、简体中文和繁体中文版本。

## 工作原理

该插件基于“抓取源”(Fetch Sources) 工作。每个源都是一个已保存的配置，指向一个特定的 Airtable 视图。当您触发抓取时，插件会连接到 Airtable API，从您指定的视图中检索记录，然后在您的 Obsidian 仓库中创建或更新 `.md` 文件。

### Airtable 表格结构要求

要使用此插件，您的 Airtable 表格必须包含几个特定字段。插件会按名称查找这些字段以正确创建笔记。

| 字段名称    | 字段类型                                           | 是否必须 | 描述                                                                                      |
| :---------- | :------------------------------------------------- | :------- | :---------------------------------------------------------------------------------------- |
| `Title`     | 单行文本 (Single line text)                        | **是**   | 此字段中的值将成为您的 Obsidian 笔记的文件名和标题。                                      |
| `MD`        | 长文本 (Long text)                                 | **是**   | 您的 Obsidian 笔记内容。您可以在 Airtable 中为此字段启用 Markdown 格式。                  |
| `SubFolder` | 单行文本或单选 (Single line text or Single Select) | 否       | (可选) 如果您想将笔记整理到子文件夹中，请在此处指定子文件夹路径 (例如 `项目 A/任务`)。    |
| `Extension` | 单行文本或单选 (Single line text or Single Select) | 否       | (可选) 笔记的文件扩展名 (例如 `txt`, `css`, `js`)。如果未提供，则默认为 `md`。            |
| `UpdatedIn` | 公式 (数字) (Formula (Number))                     | **是**   | 一个计算记录自上次修改以来天数的公式。这对于“智能同步”功能至-至关重要。请参阅下面的公式。 |

**`UpdatedIn` 字段公式:**

您必须创建一个名为 `UpdatedIn` 的公式字段，你可以使用以下 Airtable 公式。这使得插件能够仅抓取最近更改过的记录。

```
DATETIME_DIFF(TODAY(), LAST_MODIFIED_TIME(), 'days')
```

##快速入门

请按照以下步骤设置您在 Obsidian 和 Airtable 之间的第一个连接。

### 步骤 1: 安装插件

建议使用 Brat 插件安装本插件。

### 步骤 2: 获取您的 Airtable 信息

1.  **Airtable 网址 (URL)**:

    -   打开您的 Airtable 数据库，并导航到您想要从中抓取数据的特定 **视图 (View)**。
    -   从浏览器的地址栏中复制完整的 URL。它看起来应该像这样：`https://airtable.com/appXXXXXXXXXXXXXX/tblXXXXXXXXXXXXXX/viwXXXXXXXXXXXXXX`

2.  **Airtable API 密钥 (Personal Access Token)**:
    -   前往您的 Airtable [开发者中心 (Developer Hub)](https://airtable.com/create/tokens)。
    -   点击 **+ Create new token**。
    -   为您的令牌命名 (例如 "Obsidian Fetcher")。
    -   对于 **Scopes** (范围)，您必须添加 `data.records:read`。
    -   对于 **Access** (访问权限)，选择您要授权访问的数据库。
    -   点击 **Create token** 并复制生成的令牌密钥。

### 步骤 3: 配置抓取源

1.  打开 Obsidian **设置 (Settings)**。
2.  前往 **Community Plugins** > **Airtable Fetcher**。
3.  点击 **+ 添加新数据源**。将出现一个卡片供您编辑。点击 **铅笔图标** 打开编辑模式。
4.  填写详细信息：
    -   **数据源名称**: 此连接的描述性名称 (例如 "项目跟踪器")。此名称将显示在命令面板中。
    -   **数据源 URL**: 粘贴您之前复制的 Airtable 视图 URL。
    -   **API 密钥**: 粘贴您的 Airtable 个人访问令牌。
    -   **目标路径**: 指定笔记应保存在您仓库中的哪个文件夹 (例如 `Data/projects`)。如果该文件夹不存在，插件将创建它。
5.  点击 **确定**。

## 使用方法

### 抓取数据

1.  打开 **命令面板 (Command Palette)** ( `Ctrl+P` 或 `Cmd+P`)。
2.  输入 `Airtable Fetch`，后跟您的源名称 (例如 `Fetch Project Tracker`)。
3.  从列表中选择命令。
4.  将出现一个新对话框，要求您选择一个时间范围。您可以选择抓取所有笔记或仅抓取最近更新的笔记。
5.  插件将从 Airtable 抓取数据，并在您指定的目标路径中创建/更新笔记。您将看到指示进度的通知。

### 管理抓取源

设置页面以卡片视图的形式提供了您所有的抓取源。

-   **编辑**: 点击 **铅笔图标** 修改源的详细信息。
-   **删除**: 点击 **垃圾桶图标** 删除一个源。
-   **复制**: 点击 **复制图标** 将单个源的配置 (以 JSON 格式) 复制到剪贴板。这对于复制一个源很有用。
-   **导出/导入**:
    -   **导出**: 使用 **导出所有数据源** 按钮复制所有标记为 "Export" 的源的配置。
    -   **导入**: 使用 **导入新数据源** 按钮粘贴 JSON 配置，以批量添加一个或多个源。
