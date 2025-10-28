
export enum Author {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system',
}

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  MARKDOWN = 'markdown',
  GROUNDING = 'grounding',
}

export enum AssistantMode {
    BEST = 'BEST',
    ANSWER_EXPLAIN = 'ANSWER_EXPLAIN',
    WRITE_EDIT = 'WRITE_EDIT',
    CODE_DEBUG = 'CODE_DEBUG',
    CREATE_DESIGN = 'CREATE_DESIGN',
    PLAN_ORGANIZE = 'PLAN_ORGANIZE',
    // Specialized, non-text modes
    IMAGE_GEN = 'imagen-4.0-generate-001',
    VIDEO_GEN = 'veo-3.1-fast-generate-preview',
    IMAGE_EDIT = 'gemini-2.5-flash-image',
    LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025',
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";

export interface TextContent {
  type: ContentType.TEXT | ContentType.MARKDOWN;
  text: string;
}

export interface ImageContent {
  type: ContentType.IMAGE;
  url: string;
  alt: string;
}

export interface VideoContent {
  type: ContentType.VIDEO;
  url: string;
}

export interface GroundingContent {
    type: ContentType.GROUNDING,
    sources: { title: string, uri: string }[];
}

export type MessageContent = TextContent | ImageContent | VideoContent | GroundingContent;

export interface Message {
  id: string;
  author: Author;
  content: MessageContent[];
  isLoading?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}