CREATE TABLE login (
	id serial PRIMARY KEY,
	hash varchar(100),
	email text UNIQUE not null
);

CREATE TABLE users (
	id serial PRIMARY KEY,
	name VARCHAR(200),
	email text UNIQUE NOT NULL,
	entries BIGINT DEFAULT 0,
	joined TIMESTAMP NOT NULL
);