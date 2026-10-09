import { Schema } from "effect";

const Options = Schema.Struct({
  model: Schema.optional(Schema.String),
  query: Schema.optional(Schema.String),
  queries: Schema.optional(Schema.Struct({
    review: Schema.optional(Schema.String),
    assigned: Schema.optional(Schema.String),
    authored: Schema.optional(Schema.String),
  })),
});

export interface SessionModel {
  readonly providerID: string;
  readonly id: string;
  readonly variant?: string;
}

export interface SearchQueries {
  readonly review: string;
  readonly assigned: string;
  readonly authored: string;
}

export interface PluginOptions {
  readonly model: SessionModel;
  readonly queries: SearchQueries;
}

const BASE_QUERY = "is:pr is:open archived:false sort:updated-desc";

/** Parse provider/model#variant at the options boundary, before creating sessions. */
const parseModel = (value: string): SessionModel => {
  const match = /^([^/\s#]+)\/([^\s#]+)(?:#([^\s#]+))?$/.exec(value.trim());
  const providerID = match?.[1];
  const id = match?.[2];
  const variant = match?.[3];
  if (providerID === undefined || id === undefined) {
    throw new Error("Pull requests: model must be provider/model or provider/model#variant");
  }
  return { providerID, id, ...(variant === undefined ? {} : { variant }) };
};

/** Overrides replace group selectors, not the open-PR constraints; common filters apply to every group. */
export const parseOptions = (input: unknown): PluginOptions => {
  const options = Schema.decodeUnknownSync(Options)(input, { onExcessProperty: "error" });
  const filter = options.query?.trim() ?? "";
  const buildQuery = (name: string, selector: string): string => {
    if (selector.trim().length === 0) throw new Error(`Pull requests: queries.${name} must not be empty`);
    return [BASE_QUERY, selector.trim(), filter].filter((part) => part.length > 0).join(" ");
  };
  return {
    model: parseModel(options.model ?? "github-copilot/gpt-6-luna"),
    queries: {
      review: buildQuery("review", options.queries?.review ?? "review-requested:@me"),
      assigned: buildQuery("assigned", options.queries?.assigned ?? "assignee:@me -author:@me"),
      authored: buildQuery("authored", options.queries?.authored ?? "author:@me"),
    },
  };
};

export const DEFAULT_OPTIONS = parseOptions({});
