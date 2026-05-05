import React from 'react';
import api from '../services/api';

function TimetableCell({ slot, reload }) {
  const toggleLock = async () => {
    await api.put('/slot/lock', {
      id: slot.id,
      locked: !slot.locked
    });
    reload();
  };

  return (
    <td style={{ background: slot.locked ? '#e0d4ff' : '' }}>
      <div>{slot.subject || ''}</div>
      <div style={{ fontSize: '12px' }}>{slot.faculty || ''}</div>

      {slot.subject && (
        <button onClick={toggleLock}>
          {slot.locked ? '🔒' : '🔓'}
        </button>
      )}
    </td>
  );
}

export default TimetableCell;