import { getNotionClient, getNotionDatabaseId } from "@/lib/notion/client";
import { type GoalInput, type GoalPlan, type LearningSource, type Quest, type WebSourceResult } from "@/lib/types";

type NotionProperties = Record<string, any>;

type NotionSchema = {
  dataSourceId: string;
  titleProperty: string;
  statusProperty?: string;
  properties: NotionProperties;
};

const richTextLimit = 1900;
const notionRecordTypes = ["Source", "Goal", "Mission", "Quest"] as const;

export type NotionRecordType = (typeof notionRecordTypes)[number];

export type NotionRecordPreview = {
  id: string;
  title: string;
  type: NotionRecordType | "Unknown";
  status: string;
  summary: string;
};

export type NotionWorkspaceSummary = {
  connected: boolean;
  databaseUrl?: string;
  counts: Record<NotionRecordType, number>;
  recent: NotionRecordPreview[];
};

let schemaPromise: Promise<NotionSchema | null> | null = null;

export async function recordQuestCompletionToNotion(input: {
  quest: Quest;
  completionId: string;
  userId: string;
  completedAt: string;
}) {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return;
  }

  const existingPage =
    input.quest.source === "manual"
      ? await findNotionPageBySupabaseId(schema, input.quest.id).catch(() => null)
      : null;

  if (existingPage) {
    await notion.pages.update({
      page_id: existingPage.id,
      properties: compactProperties({
        ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("완료") } : {}),
        XP: numberProperty(input.quest.xp),
        "Completed At": dateProperty(input.completedAt),
        Summary: richTextProperty(input.quest.description)
      }, schema.properties)
    });

    return existingPage.id;
  }

  const page = await notion.pages.create({
    parent: {
      data_source_id: schema.dataSourceId
    },
    properties: compactProperties({
      [schema.titleProperty]: titleProperty(input.quest.title),
      ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("완료") } : {}),
      Type: selectProperty("Quest"),
      Category: selectProperty(input.quest.category),
      Source: selectProperty(input.quest.source),
      XP: numberProperty(input.quest.xp),
      "Completed At": dateProperty(input.completedAt),
      "Supabase ID": richTextProperty(input.quest.source === "manual" ? input.quest.id : input.completionId),
      Summary: richTextProperty(input.quest.description)
    }, schema.properties)
  });

  return page.id;
}

export async function recordManualQuestToNotion(input: {
  quest: Quest;
  userId: string;
}) {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return;
  }

  const existingPage = await findNotionPageBySupabaseId(schema, input.quest.id).catch(() => null);

  if (existingPage) {
    await notion.pages.update({
      page_id: existingPage.id,
      archived: false,
      properties: compactProperties({
        [schema.titleProperty]: titleProperty(input.quest.title),
        ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("시작 전") } : {}),
        Type: selectProperty("Quest"),
        Category: selectProperty(input.quest.category),
        Source: selectProperty("manual"),
        XP: numberProperty(input.quest.xp),
        Summary: richTextProperty(input.quest.description)
      }, schema.properties)
    });

    return existingPage.id;
  }

  const page = await notion.pages.create({
    parent: {
      data_source_id: schema.dataSourceId
    },
    properties: compactProperties({
      [schema.titleProperty]: titleProperty(input.quest.title),
      ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("시작 전") } : {}),
      Type: selectProperty("Quest"),
      Category: selectProperty(input.quest.category),
      Source: selectProperty("manual"),
      XP: numberProperty(input.quest.xp),
      "Supabase ID": richTextProperty(input.quest.id),
      Summary: richTextProperty(input.quest.description)
    }, schema.properties)
  });

  return page.id;
}

export async function recordGoalPlanToNotion(input: {
  goal: GoalInput;
  plan: GoalPlan;
  userId: string;
  goalId?: string;
  previousTitle?: string;
}) {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return;
  }

  const existingPage =
    input.goalId
      ? ((await findNotionGoalPage(schema, { supabaseId: input.goalId }).catch(() => null)) ??
          (input.previousTitle
            ? await findNotionGoalPage(schema, {
                supabaseId: input.userId,
                title: input.previousTitle
              }).catch(() => null)
            : null))
      : null;

  const properties = compactProperties({
    [schema.titleProperty]: titleProperty(input.goal.title),
    ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("진행 중") } : {}),
    Type: selectProperty("Goal"),
    Category: selectProperty(input.goal.category),
    XP: numberProperty(0),
    "Completed At": dateProperty(new Date().toISOString()),
    "Supabase ID": richTextProperty(input.goalId ?? input.userId),
    Summary: richTextProperty(input.plan.summary),
    Plan: richTextProperty(formatGoalPlan(input.plan))
  }, schema.properties);

  if (existingPage) {
    await notion.pages.update({
      page_id: existingPage.id,
      archived: false,
      properties
    });

    return existingPage.id;
  }

  const page = await notion.pages.create({
    parent: {
      data_source_id: schema.dataSourceId
    },
    properties
  });

  return page.id;
}

export async function recordWebSourceToNotion(input: {
  source: WebSourceResult;
  userId: string;
}) {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return;
  }

  const existingPage = await findNotionSourceByUrl(schema, input.source.url).catch(() => null);
  const properties = compactProperties({
    [schema.titleProperty]: titleProperty(input.source.title),
    ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("시작 전") } : {}),
    Type: selectProperty("Source"),
    Category: selectProperty(input.source.category),
    "Supabase ID": richTextProperty(`web:${input.source.url}`),
    Summary: richTextProperty(input.source.summary),
    URL: urlProperty(input.source.url)
  }, schema.properties);

  if (existingPage) {
    await notion.pages.update({
      page_id: existingPage.id,
      archived: false,
      properties
    });

    return existingPage.id;
  }

  const page = await notion.pages.create({
    parent: {
      data_source_id: schema.dataSourceId
    },
    properties
  });

  return page.id;
}

export async function archiveNotionPage(pageId?: string) {
  const notion = getNotionClient();

  if (!notion || !pageId) {
    return;
  }

  await notion.pages.update({
    page_id: pageId,
    archived: true
  });
}

export async function archiveNotionQuestBySupabaseId(supabaseId: string) {
  const schema = await getPreparedSchema();
  const page = schema ? await findNotionPageBySupabaseId(schema, supabaseId) : null;

  await archiveNotionPage(page?.id);
}

export async function archiveNotionGoal(input: {
  goalId: string;
  userId: string;
  title: string;
}) {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return;
  }

  const page =
    (await findNotionGoalPage(schema, {
      supabaseId: input.goalId
    }).catch(() => null)) ??
    (await findNotionGoalPage(schema, {
      supabaseId: input.userId,
      title: input.title
    }).catch(() => null));

  await archiveNotionPage(page?.id);
}

export async function undoNotionQuestCompletion(input: {
  quest: Quest;
  notionPageId?: string;
}) {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return;
  }

  if (input.quest.source !== "manual") {
    await archiveNotionPage(input.notionPageId);
    return;
  }

  const page = input.notionPageId
    ? { id: input.notionPageId }
    : await findNotionPageBySupabaseId(schema, input.quest.id);

  if (!page?.id) {
    return;
  }

  await notion.pages.update({
    page_id: page.id,
    archived: false,
    properties: compactProperties({
      ...(schema.statusProperty ? { [schema.statusProperty]: statusProperty("시작 전") } : {}),
      "Completed At": emptyDateProperty()
    }, schema.properties)
  });
}

export async function checkNotionConnection() {
  const schema = await getPreparedSchema();
  return Boolean(schema);
}

export async function getNotionWorkspaceSummary(): Promise<NotionWorkspaceSummary> {
  const counts = createEmptyCounts();
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return {
      connected: false,
      counts,
      recent: []
    };
  }

  try {
    const response = (await notion.dataSources.query({
      data_source_id: schema.dataSourceId,
      page_size: 100
    })) as any;

    const recent = response.results
      .map((page: any) => mapNotionRecordPreview(page, schema))
      .filter(Boolean) as NotionRecordPreview[];

    recent.forEach((record) => {
      if (record.type !== "Unknown") {
        counts[record.type] += 1;
      }
    });

    return {
      connected: true,
      databaseUrl: `https://www.notion.so/${getNotionDatabaseId()}`,
      counts,
      recent: recent.slice(0, 8)
    };
  } catch {
    return {
      connected: false,
      counts,
      recent: []
    };
  }
}

export async function getNotionSources(limit = 8): Promise<LearningSource[]> {
  const schema = await getPreparedSchema();
  const notion = getNotionClient();

  if (!schema || !notion) {
    return [];
  }

  try {
    const filters: any[] = [];

    if (schema.properties.Type) {
      filters.push({
        property: "Type",
        select: {
          equals: "Source"
        }
      });
    }

    const response = (await notion.dataSources.query({
      data_source_id: schema.dataSourceId,
      ...(filters.length > 0
        ? {
            filter: filters.length === 1 ? filters[0] : { and: filters }
          }
        : {}),
      page_size: limit
    })) as any;

    return (response.results ?? [])
      .map((page: any) => mapNotionSource(page, schema))
      .filter(Boolean) as LearningSource[];
  } catch {
    return [];
  }
}

async function getPreparedSchema() {
  schemaPromise ??= prepareDatabaseSchema().catch(() => null);
  const schema = await schemaPromise;

  if (!schema) {
    schemaPromise = null;
  }

  return schema;
}

async function prepareDatabaseSchema(): Promise<NotionSchema | null> {
  const notion = getNotionClient();

  if (!notion) {
    return null;
  }

  const dataSourceId = await resolveDataSourceId();
  const dataSource = (await notion.dataSources.retrieve({
    data_source_id: dataSourceId
  })) as any;
  const properties = dataSource.properties as NotionProperties;
  const titleProperty = findPropertyName(properties, "title");
  const statusProperty = findPropertyName(properties, "status");
  const missingProperties: NotionProperties = {};

  if (!titleProperty) {
    return null;
  }

  if (!properties.Type) {
    missingProperties.Type = {
      type: "select",
      select: {
        options: [
          { name: "Mission", color: "blue" },
          { name: "Quest", color: "green" },
          { name: "Goal", color: "purple" },
          { name: "Source", color: "orange" }
        ]
      }
    };
  }

  if (!properties.Category) {
    missingProperties.Category = {
      type: "select",
      select: {
        options: [
          { name: "sql", color: "blue" },
          { name: "coding", color: "orange" },
          { name: "study", color: "green" },
          { name: "review", color: "yellow" }
        ]
      }
    };
  }

  if (!properties.Source) {
    missingProperties.Source = {
      type: "select",
      select: {
        options: [
          { name: "calendar", color: "blue" },
          { name: "weekly-mission", color: "purple" },
          { name: "manual", color: "green" },
          { name: "notion-source", color: "orange" }
        ]
      }
    };
  }

  if (!properties.XP) {
    missingProperties.XP = { type: "number", number: { format: "number" } };
  }

  if (!properties["Completed At"]) {
    missingProperties["Completed At"] = { type: "date", date: {} };
  }

  if (!properties["Supabase ID"]) {
    missingProperties["Supabase ID"] = { type: "rich_text", rich_text: {} };
  }

  if (!properties.Summary) {
    missingProperties.Summary = { type: "rich_text", rich_text: {} };
  }

  if (!properties.Plan) {
    missingProperties.Plan = { type: "rich_text", rich_text: {} };
  }

  if (!properties.URL) {
    missingProperties.URL = { type: "url", url: {} };
  }

  if (Object.keys(missingProperties).length > 0) {
    const updatedDataSource = (await notion.dataSources.update({
      data_source_id: dataSourceId,
      properties: missingProperties
    } as any)) as any;

    return {
      dataSourceId,
      titleProperty,
      statusProperty,
      properties: updatedDataSource.properties ?? { ...properties, ...missingProperties }
    };
  }

  return {
    dataSourceId,
    titleProperty,
    statusProperty,
    properties
  };
}

async function resolveDataSourceId() {
  const notion = getNotionClient();

  if (!notion) {
    throw new Error("Notion is not configured.");
  }

  const configuredId = getNotionDatabaseId();

  try {
    const database = (await notion.databases.retrieve({
      database_id: configuredId
    })) as any;
    const dataSourceId = database.data_sources?.[0]?.id;

    if (dataSourceId) {
      return dataSourceId;
    }
  } catch {
    // The configured ID may already be a data source ID.
  }

  const dataSource = (await notion.dataSources.retrieve({
    data_source_id: configuredId
  })) as any;

  return dataSource.id as string;
}

async function findNotionPageBySupabaseId(schema: NotionSchema, supabaseId: string) {
  const notion = getNotionClient();

  if (!notion || !schema.properties["Supabase ID"]) {
    return null;
  }

  const response = (await notion.dataSources.query({
    data_source_id: schema.dataSourceId,
    filter: {
      property: "Supabase ID",
      rich_text: {
        equals: supabaseId
      }
    },
    page_size: 1
  })) as any;

  return response.results?.[0] ?? null;
}

async function findNotionGoalPage(
  schema: NotionSchema,
  input: {
    supabaseId: string;
    title?: string;
  }
) {
  const notion = getNotionClient();

  if (!notion || !schema.properties["Supabase ID"]) {
    return null;
  }

  const filters: any[] = [
    {
      property: "Supabase ID",
      rich_text: {
        equals: input.supabaseId
      }
    }
  ];

  if (schema.properties.Type) {
    filters.push({
      property: "Type",
      select: {
        equals: "Goal"
      }
    });
  }

  if (input.title?.trim()) {
    filters.push({
      property: schema.titleProperty,
      title: {
        equals: input.title
      }
    });
  }

  const response = (await notion.dataSources.query({
    data_source_id: schema.dataSourceId,
    filter:
      filters.length === 1
        ? filters[0]
        : {
            and: filters
          },
    page_size: 1
  })) as any;

  return response.results?.[0] ?? null;
}

async function findNotionSourceByUrl(schema: NotionSchema, url: string) {
  const notion = getNotionClient();

  if (!notion || !schema.properties.URL) {
    return null;
  }

  const response = (await notion.dataSources.query({
    data_source_id: schema.dataSourceId,
    filter: {
      property: "URL",
      url: {
        equals: url
      }
    },
    page_size: 1
  })) as any;

  return response.results?.[0] ?? null;
}

function findPropertyName(properties: NotionProperties, type: string) {
  return Object.entries(properties).find(([, value]) => value?.type === type)?.[0];
}

function compactProperties(properties: NotionProperties, schemaProperties: NotionProperties) {
  return Object.fromEntries(
    Object.entries(properties).filter(([name]) => Boolean(schemaProperties[name]))
  );
}

function titleProperty(content: string) {
  return {
    title: [
      {
        text: {
          content: content.slice(0, 200)
        }
      }
    ]
  };
}

function richTextProperty(content: string) {
  return {
    rich_text: [
      {
        text: {
          content: content.slice(0, richTextLimit)
        }
      }
    ]
  };
}

function selectProperty(name: string) {
  return {
    select: {
      name
    }
  };
}

function statusProperty(name: string) {
  return {
    status: {
      name
    }
  };
}

function numberProperty(value: number) {
  return {
    number: value
  };
}

function dateProperty(start: string) {
  return {
    date: {
      start
    }
  };
}

function urlProperty(url: string) {
  return {
    url
  };
}

function emptyDateProperty() {
  return {
    date: null
  };
}

function formatGoalPlan(plan: GoalPlan) {
  const weeks = plan.weeks
    .map((week) => {
      const tasks = week.daily
        .map((day) => `${day.day}: ${day.tasks.join(", ")}`)
        .join("\n");

      return `Week ${week.week} - ${week.theme}\n${tasks}`;
    })
    .join("\n\n");

  return `${plan.summary}\n\n${plan.advice}\n\n${weeks}`;
}

function createEmptyCounts() {
  return notionRecordTypes.reduce(
    (counts, type) => ({
      ...counts,
      [type]: 0
    }),
    {} as Record<NotionRecordType, number>
  );
}

function mapNotionRecordPreview(page: any, schema: NotionSchema): NotionRecordPreview | null {
  if (!page?.id || !page.properties) {
    return null;
  }

  const type = readSelectProperty(page.properties.Type);

  return {
    id: page.id,
    title: readTitleProperty(page.properties[schema.titleProperty]),
    type: isNotionRecordType(type) ? type : "Unknown",
    status: schema.statusProperty ? readStatusProperty(page.properties[schema.statusProperty]) : "",
    summary: readRichTextProperty(page.properties.Summary)
  };
}

function mapNotionSource(page: any, schema: NotionSchema): LearningSource | null {
  if (!page?.id || !page.properties) {
    return null;
  }

  const title = readTitleProperty(page.properties[schema.titleProperty]);
  const summary = readRichTextProperty(page.properties.Summary);
  const url = readUrlProperty(page.properties.URL);
  const category = readSelectProperty(page.properties.Category);
  const status = schema.statusProperty ? readStatusProperty(page.properties[schema.statusProperty]) : "";

  if (!title || title === "제목 없음") {
    return null;
  }

  return {
    id: page.id,
    title,
    summary,
    ...(url ? { url } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {})
  };
}

function isNotionRecordType(type: string) {
  return notionRecordTypes.some((recordType) => recordType === type);
}

function readTitleProperty(property: any) {
  return property?.title?.map((item: any) => item.plain_text ?? "").join("") || "제목 없음";
}

function readRichTextProperty(property: any) {
  return property?.rich_text?.map((item: any) => item.plain_text ?? "").join("") || "";
}

function readSelectProperty(property: any) {
  return property?.select?.name ?? "";
}

function readStatusProperty(property: any) {
  return property?.status?.name ?? "";
}

function readUrlProperty(property: any) {
  return property?.url ?? "";
}
