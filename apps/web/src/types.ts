export interface ArticleBrief {
  title: string;
  summary: string;
  keyPoints: string[];
  tone: 'neutral' | 'persuasive' | 'technical' | 'friendly';
  tags: string[];
}

export interface Usage {
  promptTokens?: number;
  candidateTokens?: number;
  totalTokens?: number;
}

export interface TextResult {
  text: string;
  model: string;
  mocked: boolean;
  usage?: Usage;
}

export interface StructuredResult {
  brief: ArticleBrief;
  model: string;
  mocked: boolean;
  attempts: number;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatResult {
  conversationId: string;
  text: string;
  model: string;
  mocked: boolean;
  usage?: Usage;
  createdAt: string;
}

export interface SecurityResult {
  echo: string;
  priority: string;
  verifiedUid: string;
  receivedAt: string;
  checks: string[];
}

export interface UsageSummary {
  months: Array<{
    id: string;
    month?: string;
    requests?: number;
    tokens?: number;
    byEndpoint?: Record<string, number>;
  }>;
}
