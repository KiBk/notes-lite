const request = require('supertest');
const app = require('../src/app');

async function createUser(name = 'Alice') {
  const res = await request(app).post('/api/session').send({ name });
  return res.body.user;
}

async function createNote(userId, payload = {}) {
  const res = await request(app)
    .post('/api/notes')
    .send({
      userId,
      title: payload.title || 'Title',
      body: payload.body || 'Body',
      color: payload.color,
    })
    .expect(201);
  return res.body.note;
}

describe('Notes API', () => {
  test('allows simple sign-in with name', async () => {
    const res = await request(app).post('/api/session').send({ name: 'Charlie' }).expect(200);

    expect(res.body.user).toMatchObject({
      name: 'Charlie',
    });
    expect(typeof res.body.user.id).toBe('number');
  });

  test('supports note lifecycle actions', async () => {
    const user = await createUser('Delia');

    const created = await createNote(user.id, { title: 'First', body: 'Example' });
    expect(created).toMatchObject({
      title: 'First',
      body: 'Example',
      pinned: false,
      archived: false,
      color: '#f8fafc',
    });

    const listRes = await request(app)
      .get(`/api/notes?userId=${user.id}`)
      .expect(200);

    expect(listRes.body.notes.unpinned).toHaveLength(1);
    expect(listRes.body.notes.pinned).toHaveLength(0);
    expect(listRes.body.notes.archived).toHaveLength(0);

    const pinnedRes = await request(app)
      .patch(`/api/notes/${created.id}`)
      .send({ userId: user.id, pinned: true })
      .expect(200);
    expect(pinnedRes.body.note.pinned).toBe(true);

    const afterPin = await request(app)
      .get(`/api/notes?userId=${user.id}`)
      .expect(200);
    expect(afterPin.body.notes.pinned[0].id).toBe(created.id);

    const archivedRes = await request(app)
      .patch(`/api/notes/${created.id}`)
      .send({ userId: user.id, archived: true })
      .expect(200);
    expect(archivedRes.body.note.archived).toBe(true);

    const searchRes = await request(app)
      .get(`/api/notes?userId=${user.id}&search=First`)
      .expect(200);
    expect(searchRes.body.notes.archived[0].id).toBe(created.id);

    await request(app)
      .delete(`/api/notes/${created.id}`)
      .query({ userId: user.id })
      .expect(200);

    const afterDelete = await request(app)
      .get(`/api/notes?userId=${user.id}`)
      .expect(200);
    expect(afterDelete.body.notes.unpinned).toHaveLength(0);
  });

  test('reorders pinned, unpinned, and archived independently', async () => {
    const user = await createUser('Ella');

    const first = await createNote(user.id, { title: 'first' });
    const second = await createNote(user.id, { title: 'second' });
    const third = await createNote(user.id, { title: 'third' });

    await request(app)
      .patch(`/api/notes/${first.id}`)
      .send({ userId: user.id, pinned: true })
      .expect(200);
    await request(app)
      .patch(`/api/notes/${second.id}`)
      .send({ userId: user.id, archived: true })
      .expect(200);

    const reorderRes = await request(app)
      .post('/api/notes/reorder')
      .send({
        userId: user.id,
        pinnedIds: [first.id],
        unpinnedIds: [third.id],
        archivedIds: [second.id],
      })
      .expect(200);

    expect(reorderRes.body.notes.pinned.map((n) => n.id)).toEqual([first.id]);
    expect(reorderRes.body.notes.unpinned.map((n) => n.id)).toEqual([third.id]);
    expect(reorderRes.body.notes.archived.map((n) => n.id)).toEqual([second.id]);
  });

  test('allows setting and updating note color', async () => {
    const user = await createUser('Fiona');

    const created = await createNote(user.id, {
      title: 'Colorful',
      body: 'Palette test',
      color: '#fde68a',
    });

    expect(created.color).toBe('#fde68a');

    const updated = await request(app)
      .patch(`/api/notes/${created.id}`)
      .send({ userId: user.id, color: '#bfdbfe' })
      .expect(200);

    expect(updated.body.note.color).toBe('#bfdbfe');
  });
});
