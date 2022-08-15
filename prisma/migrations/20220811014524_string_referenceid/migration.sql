/*
  Warnings:

  - The primary key for the `Tag` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Site` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BooruConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tag" (
    "reference_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "Tag_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "BooruConfig" ("reference_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Tag" ("name", "reference_id") SELECT "name", "reference_id" FROM "Tag";
DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";
CREATE TABLE "new_Site" (
    "reference_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "Site_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "BooruConfig" ("reference_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Site" ("name", "reference_id") SELECT "name", "reference_id" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
CREATE TABLE "new_BooruConfig" (
    "reference_id" TEXT NOT NULL PRIMARY KEY,
    "min_score" INTEGER NOT NULL
);
INSERT INTO "new_BooruConfig" ("min_score", "reference_id") SELECT "min_score", "reference_id" FROM "BooruConfig";
DROP TABLE "BooruConfig";
ALTER TABLE "new_BooruConfig" RENAME TO "BooruConfig";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
