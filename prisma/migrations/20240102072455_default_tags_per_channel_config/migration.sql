-- AlterTable
ALTER TABLE "booru_config" ADD COLUMN "guild_id" TEXT;

-- CreateTable
CREATE TABLE "default_tag" (
    "reference_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "default_tag_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "booru_config" ("reference_id") ON DELETE CASCADE ON UPDATE CASCADE
);
