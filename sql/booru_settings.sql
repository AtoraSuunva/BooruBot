CREATE TABLE IF NOT EXISTS booru_settings (
  guild_id bigint PRIMARY KEY,
  tags text[] DEFAULT '{}',
  sites text[] DEFAULT '{}',
  nsfwServer boolean DEFAULT FALSE,
  minScore integer DEFAULT null,
  topicEnable boolean DEFAULT FALSE,
  disableNextImage boolean DEFAULT FALSE
);
