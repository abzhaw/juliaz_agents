-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "parentVersion" INTEGER,
    "changeReason" TEXT NOT NULL,
    "changeDiff" TEXT,
    "avgScore" DOUBLE PRECISION,
    "evalCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolInteraction" (
    "id" SERIAL NOT NULL,
    "chatId" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "userMessage" TEXT NOT NULL,
    "conversationCtx" TEXT,
    "toolCalls" TEXT NOT NULL,
    "finalReply" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolEvaluation" (
    "id" SERIAL NOT NULL,
    "interactionId" INTEGER NOT NULL,
    "graderName" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "rawScore" TEXT,
    "passed" BOOLEAN NOT NULL,
    "reasoning" TEXT,
    "suggestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptOptimizationRun" (
    "id" SERIAL NOT NULL,
    "fromVersion" INTEGER NOT NULL,
    "toVersion" INTEGER,
    "evaluationsUsed" INTEGER NOT NULL,
    "avgScoreBefore" DOUBLE PRECISION NOT NULL,
    "failingGraders" TEXT NOT NULL,
    "feedbackSummary" TEXT NOT NULL,
    "optimizerModel" TEXT NOT NULL,
    "optimizerOutput" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromptOptimizationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_version_key" ON "PromptVersion"("version");

-- AddForeignKey
ALTER TABLE "ToolEvaluation" ADD CONSTRAINT "ToolEvaluation_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "ToolInteraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
