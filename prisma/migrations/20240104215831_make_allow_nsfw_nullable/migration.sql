-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_booru_config" (
    "reference_id" TEXT NOT NULL PRIMARY KEY,
    "guild_id" TEXT,
    "is_guild" BOOLEAN NOT NULL,
    "min_score" INTEGER,
    "allow_nsfw" BOOLEAN
);
INSERT INTO "new_booru_config" ("allow_nsfw", "guild_id", "is_guild", "min_score", "reference_id") SELECT "allow_nsfw", "guild_id", "is_guild", "min_score", "reference_id" FROM "booru_config";
DROP TABLE "booru_config";
ALTER TABLE "new_booru_config" RENAME TO "booru_config";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
