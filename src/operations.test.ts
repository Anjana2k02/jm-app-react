import { it, expect } from 'vitest';
import { emptyData } from './model';
import { replay, write, erase } from './operations';
it('recovers only queued changes, preserving unrelated cloud rows', () => {
  const cloud = emptyData();
  cloud.documents = [
    {
      id: 'other',
      user_id: 'u',
      title: 'Other device',
      content: [],
      created_at: '',
      updated_at: '',
    },
  ];
  const ops = [
    write('documents', [
      { id: 'd', user_id: 'u', title: 'Recovered', content: [], created_at: '', updated_at: '' },
    ]),
    write('session_songs', [{ session_id: 's', document_id: 'd', user_id: 'u', sort_order: 0 }]),
  ];
  const result = replay(cloud, ops);
  expect(result.documents.map((d) => d.id)).toEqual(['other', 'd']);
  expect(replay(result, ops)).toEqual(result);
  expect(cloud.documents).toHaveLength(1);
  const deleted = replay(result, [erase('documents', 'id', 'd')]);
  expect(deleted.documents.map((d) => d.id)).toEqual(['other']);
  expect(deleted.session_songs).toEqual([]);
});
it('replays remove/re-add/order sequences without duplicates', () => {
  const row = { session_id: 's', document_id: 'd', user_id: 'u', sort_order: 0 };
  const ops = [
    write('session_songs', [row]),
    erase('session_songs', 'session_id', 's', 'd'),
    write('session_songs', [{ ...row, sort_order: 2 }]),
  ];
  const result = replay(emptyData(), ops);
  expect(result.session_songs).toEqual([{ ...row, sort_order: 2 }]);
  expect(replay(result, ops)).toEqual(result);
});
