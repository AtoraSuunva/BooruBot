-- CreateTable
CREATE TABLE "BooruConfig" (
    "reference_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "min_score" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Tag" (
    "reference_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "Tag_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "BooruConfig" ("reference_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Site" (
    "reference_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    PRIMARY KEY ("reference_id", "name"),
    CONSTRAINT "Site_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "BooruConfig" ("reference_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
