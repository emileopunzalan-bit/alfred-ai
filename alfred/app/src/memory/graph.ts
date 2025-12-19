import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

export function makeMemory(db: Database.Database) {
  const insEntity = db.prepare(`
    INSERT INTO entity (id, type, name, propsJson, createdAt)
    VALUES (@id, @type, @name, @propsJson, @createdAt)
  `);

  const insRel = db.prepare(`
    INSERT INTO relation (id, fromId, relType, toId, propsJson, createdAt)
    VALUES (@id, @fromId, @relType, @toId, @propsJson, @createdAt)
  `);

  const findEntity = db.prepare(`
    SELECT * FROM entity
    WHERE type = @type AND name LIKE @name
    LIMIT 25
  `);

  const getEntity = db.prepare(`SELECT * FROM entity WHERE id = ?`);
  const relsFrom = db.prepare(`SELECT * FROM relation WHERE fromId = ? LIMIT 50`);
  const relsTo = db.prepare(`SELECT * FROM relation WHERE toId = ? LIMIT 50`);

  return {
    upsertEntity: (type: string, name: string, props: any = {}) => {
      // Simple MVP: always insert (later: true upsert)
      const row = {
        id: randomUUID(),
        type,
        name,
        propsJson: JSON.stringify(props ?? {}),
        createdAt: Date.now(),
      };
      insEntity.run(row);
      return row.id;
    },

    link: (fromId: string, relType: string, toId: string, props: any = {}) => {
      const row = {
        id: randomUUID(),
        fromId,
        relType,
        toId,
        propsJson: JSON.stringify(props ?? {}),
        createdAt: Date.now(),
      };
      insRel.run(row);
      return row.id;
    },

    searchEntities: (type: string, nameQuery: string) => {
      return findEntity.all({ type, name: `%${nameQuery}%` }).map((r: any) => ({
        ...r,
        props: JSON.parse(r.propsJson),
      }));
    },

    expandEntity: (id: string) => {
      const e: any = getEntity.get(id);
      if (!e) return null;
      return {
        ...e,
        props: JSON.parse(e.propsJson),
        relationsFrom: relsFrom.all(id).map((r: any) => ({ ...r, props: JSON.parse(r.propsJson) })),
        relationsTo: relsTo.all(id).map((r: any) => ({ ...r, props: JSON.parse(r.propsJson) })),
      };
    },
  };
}
