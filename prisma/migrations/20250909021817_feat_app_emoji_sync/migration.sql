-- CreateTable
CREATE TABLE "ApplicationEmoji" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "hash" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEmoji_name_key" ON "ApplicationEmoji"("name");

-- CreateIndex
CREATE INDEX "ApplicationEmoji_module_idx" ON "ApplicationEmoji"("module");
