
import { db, auth } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, query, where, getDocs, updateDoc, getDocFromServer } from 'firebase/firestore';
import { getWeeksForMonth, getMonday, formatDate } from './helpers';
import { Tournament, TournamentEntry, AccessRequest, Player, StudentPayment, CoachSalary, Session } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const testConnection = async () => {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
};

export const COLLECTIONS = {
  PLAYERS: 'players',
  SCHEDULES: 'weekly_schedules',
  ATTENDANCE: 'attendance',
  YTP: 'ytp_plans',
  SETTINGS: 'settings',
  TOURNAMENTS: 'tournaments',
  TOURNAMENT_ENTRIES: 'tournamentEntries',
  ACCESS_REQUESTS: 'access_requests',
  PAYMENTS: 'payments',
  SALARIES: 'salaries'
};

const sanitize = (data: unknown) => {
  if (!data) return data;
  return JSON.parse(JSON.stringify(data));
};

const listeners: Record<string, ((data: any) => void)[]> = {};
const emit = (key: string, data: any) => listeners[key]?.forEach(cb => cb(data));

const getLocal = (key: string) => {
  try { return JSON.parse(localStorage.getItem(key) || (['players', 'tournaments', 'tournamentEntries', 'access_requests', 'payments', 'salaries'].some(k => key.includes(k)) ? '[]' : '{}')); }
  catch { return []; }
};

const setLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
  emit(key, data);
};

export const isDemo = (user: { uid?: string } | null) => !user || (user.uid && user.uid.startsWith('demo-'));

export const dbService = {
  checkUserRole: async (user: any, _appId: string): Promise<{role: 'COACH' | 'PLAYER' | 'PENDING', playerId?: string}> => {
      if (isDemo(user)) return { role: 'COACH' };
      try {
        const q = query(collection(db, COLLECTIONS.PLAYERS), where('linkedUid', '==', user.uid));
        const snap = await getDocs(q);
        if (!snap.empty) return { role: 'PLAYER', playerId: snap.docs[0].id };
        if (user.email) {
          const qEmail = query(collection(db, COLLECTIONS.PLAYERS), where('email', '==', user.email.trim()));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
              const playerDoc = snapEmail.docs[0];
              if (!playerDoc.data().linkedUid) {
                  await updateDoc(doc(db, COLLECTIONS.PLAYERS, playerDoc.id), { linkedUid: user.uid, linkedEmail: user.email });
              }
              return { role: 'PLAYER', playerId: playerDoc.id };
          }
        }
        const qReq = query(collection(db, COLLECTIONS.ACCESS_REQUESTS), where('uid', '==', user.uid));
        const snapReq = await getDocs(qReq);
        if(!snapReq.empty) return { role: 'PENDING' };
        return { role: 'COACH' }; 
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, COLLECTIONS.PLAYERS);
        return { role: 'COACH' };
      }
  },

  sendAccessRequest: async (user: any, appId: string, playerId: string, playerName: string) => {
      const id = user.uid;
      try {
        const playerDoc = await getDoc(doc(db, COLLECTIONS.PLAYERS, playerId));
        const coachId = playerDoc.exists() ? playerDoc.data().userId : '';
        const request: AccessRequest = { id, uid: user.uid, email: user.email, displayName: user.displayName, photoUrl: user.photoURL, playerId, playerName, coachId, status: 'pending', createdAt: new Date().toISOString() };
        if(isDemo(user)) { const list = getLocal('access_requests'); list.push(request); setLocal('access_requests', list); }
        else await setDoc(doc(db, COLLECTIONS.ACCESS_REQUESTS, id), sanitize(request));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.ACCESS_REQUESTS);
      }
  },

  cancelAccessRequest: async (user: any) => {
      if(isDemo(user)) { setLocal('access_requests', getLocal('access_requests').filter((r: any) => r.uid !== user.uid)); }
      else { 
        try {
          const q = query(collection(db, COLLECTIONS.ACCESS_REQUESTS), where('uid', '==', user.uid)); 
          const snap = await getDocs(q); 
          const deletePromises = snap.docs.map(d => deleteDoc(doc(db, COLLECTIONS.ACCESS_REQUESTS, d.id)));
          await Promise.all(deletePromises);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.ACCESS_REQUESTS);
        }
      }
  },

  subscribeAccessRequests: (user: any, appId: string, cb: (data: AccessRequest[]) => void) => {
      if(isDemo(user)) { cb(getLocal('access_requests')); return () => {}; }
      return onSnapshot(query(collection(db, COLLECTIONS.ACCESS_REQUESTS), where('coachId', '==', user.uid)), 
        (snap) => cb(snap.docs.map(d => d.data() as AccessRequest)),
        (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ACCESS_REQUESTS)
      );
  },

  approveAccessRequest: async (user: any, appId: string, request: AccessRequest) => {
      if(isDemo(user)) {
          setLocal('access_requests', getLocal('access_requests').filter((r: any) => r.id !== request.id));
          const players = getLocal('players');
          const idx = players.findIndex((p: any) => p.id === request.playerId);
          if(idx > -1) { players[idx].linkedUid = request.uid; players[idx].linkedEmail = request.email; setLocal('players', players); }
      } else {
          try {
            await deleteDoc(doc(db, COLLECTIONS.ACCESS_REQUESTS, request.id));
            await updateDoc(doc(db, COLLECTIONS.PLAYERS, request.playerId), { linkedUid: request.uid, linkedEmail: request.email });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.PLAYERS);
          }
      }
  },

  rejectAccessRequest: async (user: any, appId: string, requestId: string) => {
      if(isDemo(user)) setLocal('access_requests', getLocal('access_requests').filter((r: any) => r.id !== requestId));
      else {
        try {
          await deleteDoc(doc(db, COLLECTIONS.ACCESS_REQUESTS, requestId));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.ACCESS_REQUESTS);
        }
      }
  },

  subscribePlayers: (user: any, appId: string, cb: (data: Player[]) => void) => {
    if (isDemo(user)) { cb(getLocal('players')); return () => {}; }
    const q = user.role === 'PLAYER' ? query(collection(db, COLLECTIONS.PLAYERS), where('linkedUid', '==', user.uid)) : query(collection(db, COLLECTIONS.PLAYERS), where('userId', '==', user.uid));
    return onSnapshot(q, 
      (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as Player))),
      (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PLAYERS)
    );
  },
  
  savePlayer: async (user: any, appId: string, data: Player) => {
    if (isDemo(user)) {
      const list = getLocal('players');
      const idx = list.findIndex((i: any) => i.id === data.id);
      if (idx > -1) list[idx] = data; else list.push(data);
      setLocal('players', list);
    } else {
      try {
        await setDoc(doc(db, COLLECTIONS.PLAYERS, data.id), sanitize({ ...data, userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.PLAYERS);
      }
    }
  },

  deletePlayer: async (user: any, appId: string, id: string) => {
    if (isDemo(user)) setLocal('players', getLocal('players').filter((i: any) => i.id !== id));
    else {
      try {
        await deleteDoc(doc(db, COLLECTIONS.PLAYERS, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.PLAYERS);
      }
    }
  },

  syncPlayerEvents: async (_user: any, _appId: string, _player: Player) => {
    return;
  },

  unlinkPlayer: async (user: any, appId: string, playerId: string) => {
    if (isDemo(user)) {
      const players = getLocal('players');
      const idx = players.findIndex((p: any) => p.id === playerId);
      if (idx > -1) {
        const rest = { ...players[idx] };
        delete rest.linkedUid;
        delete rest.linkedEmail;
        players[idx] = rest;
        setLocal('players', players);
      }
    } else {
      try {
        await updateDoc(doc(db, COLLECTIONS.PLAYERS, playerId), {
          linkedUid: null,
          linkedEmail: null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, COLLECTIONS.PLAYERS);
      }
    }
  },

  subscribePayments: (user: any, appId: string, month: number, year: number, cb: (data: StudentPayment[]) => void) => {
    if (isDemo(user)) { cb(getLocal('payments').filter((p: any) => p.month === month && p.year === year)); return () => {}; }
    const q = query(collection(db, COLLECTIONS.PAYMENTS), where('userId', '==', user.uid), where('month', '==', month), where('year', '==', year));
    return onSnapshot(q, 
      (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as StudentPayment))),
      (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.PAYMENTS)
    );
  },

  savePayment: async (user: any, appId: string, payment: StudentPayment) => {
    if (isDemo(user)) {
      const list = getLocal('payments');
      const idx = list.findIndex((i: any) => i.id === payment.id);
      if (idx > -1) list[idx] = payment; else list.push(payment);
      setLocal('payments', list);
    } else {
      try {
        await setDoc(doc(db, COLLECTIONS.PAYMENTS, payment.id), sanitize({ ...payment, userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.PAYMENTS);
      }
    }
  },

  subscribeSalaries: (user: any, appId: string, month: number, year: number, cb: (data: CoachSalary[]) => void) => {
    if (isDemo(user)) { cb(getLocal('salaries').filter((s: any) => s.month === month && s.year === year)); return () => {}; }
    const q = query(collection(db, COLLECTIONS.SALARIES), where('userId', '==', user.uid), where('month', '==', month), where('year', '==', year));
    return onSnapshot(q, 
      (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as CoachSalary))),
      (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.SALARIES)
    );
  },

  saveSalary: async (user: any, appId: string, salary: CoachSalary) => {
    if (isDemo(user)) {
      const list = getLocal('salaries');
      const idx = list.findIndex((i: any) => i.id === salary.id);
      if (idx > -1) list[idx] = salary; else list.push(salary);
      setLocal('salaries', list);
    } else {
      try {
        await setDoc(doc(db, COLLECTIONS.SALARIES, salary.id), sanitize({ ...salary, userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.SALARIES);
      }
    }
  },

  deleteSalary: async (user: any, appId: string, id: string) => {
    if (isDemo(user)) setLocal('salaries', getLocal('salaries').filter((i: any) => i.id !== id));
    else {
      try {
        await deleteDoc(doc(db, COLLECTIONS.SALARIES, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.SALARIES);
      }
    }
  },

  subscribeSchedule: (user: any, appId: string, weekId: string, cb: (data: any) => void) => {
    if (isDemo(user)) { cb(getLocal('schedules')[weekId]?.days || {}); return () => {}; }
    return onSnapshot(doc(db, COLLECTIONS.SCHEDULES, `${user.uid}_${weekId}`), 
      (snap) => cb(snap.exists() ? snap.data().days || {} : {}),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.SCHEDULES)
    );
  },

  saveScheduleDay: async (user: any, appId: string, weekId: string, daysData: any) => {
    if (isDemo(user)) { const all = getLocal('schedules'); all[weekId] = { days: daysData, weekStart: weekId }; setLocal('schedules', all); }
    else {
      try {
        const participantIds = new Set<string>();
        Object.values(daysData).forEach((sessions: any) => {
          sessions.forEach((s: any) => {
            s.attendees?.forEach((id: string) => participantIds.add(id));
          });
        });
        await setDoc(doc(db, COLLECTIONS.SCHEDULES, `${user.uid}_${weekId}`), sanitize({ 
          days: daysData, 
          weekStart: weekId, 
          userId: user.uid,
          participantIds: Array.from(participantIds)
        }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.SCHEDULES);
      }
    }
  },

  getScheduleCounts: async (user: any, appId: string, date: Date) => {
    const weekIds = getWeeksForMonth(date);
    const counts: Record<string, number> = {};
    const targetMonth = date.getMonth();
    try {
      for (const weekId of weekIds) {
          let days = {};
          if (isDemo(user)) { days = getLocal('schedules')[weekId]?.days || {}; }
          else { const snap = await getDoc(doc(db, COLLECTIONS.SCHEDULES, `${user.uid}_${weekId}`)); if (snap.exists()) days = snap.data().days || {}; }
          Object.keys(days).forEach(dateStr => { 
              const d = new Date(dateStr); 
              if (d.getMonth() === targetMonth && (days as any)[dateStr]?.length > 0) 
                  counts[d.getDate()] = (days as any)[dateStr].length; 
          });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTIONS.SCHEDULES);
    }
    return counts;
  },

  subscribeAttendance: (user: any, appId: string, monthId: string, cb: (data: any) => void) => {
    if (isDemo(user)) { cb(getLocal('attendance')[monthId]?.records || {}); return () => {}; }
    return onSnapshot(doc(db, COLLECTIONS.ATTENDANCE, `${user.uid}_${monthId}`), 
      (snap) => cb(snap.exists() ? snap.data().records || {} : {}),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.ATTENDANCE)
    );
  },

  saveAttendance: async (user: any, appId: string, monthId: string, records: any) => {
    if (isDemo(user)) { const all = getLocal('attendance'); all[monthId] = { records, updatedAt: new Date().toISOString() }; setLocal('attendance', all); }
    else {
      try {
        await setDoc(doc(db, COLLECTIONS.ATTENDANCE, `${user.uid}_${monthId}`), sanitize({ records, updatedAt: new Date().toISOString(), userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.ATTENDANCE);
      }
    }
  },

  updateAttendanceSingle: async (user: any, appId: string, date: Date, playerId: string, status: string | null) => {
      const monthId = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const dayStr = String(date.getDate());
      if (isDemo(user)) {
          const all = getLocal('attendance'); if (!all[monthId]) all[monthId] = { records: {} };
          if (!all[monthId].records[playerId]) all[monthId].records[playerId] = {};
          all[monthId].records[playerId][dayStr] = status; setLocal('attendance', all);
      } else {
          try {
            // Use updateDoc with dot-notation to correctly target the nested property in Firestore
            const attRef = doc(db, COLLECTIONS.ATTENDANCE, `${user.uid}_${monthId}`);
            const snap = await getDoc(attRef);
            if (!snap.exists()) {
                await setDoc(attRef, { records: { [playerId]: { [dayStr]: status } }, userId: user.uid, updatedAt: new Date().toISOString() });
            } else {
                await updateDoc(attRef, { 
                  [`records.${playerId}.${dayStr}`]: status,
                  updatedAt: new Date().toISOString()
                });
            }
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.ATTENDANCE);
          }
      }
  },

  /**
   * Automatically calculates and syncs attendance status based on weekly schedules.
   */
  syncAttendanceForDay: async (user: any, appId: string, date: Date, playerId: string) => {
    if (isDemo(user)) return;
    const dateStr = formatDate(date);
    const weekId = formatDate(getMonday(date));
    
    try {
      // 1. Fetch current day's sessions
      const scheduleSnap = await getDoc(doc(db, COLLECTIONS.SCHEDULES, `${user.uid}_${weekId}`));
      if (!scheduleSnap.exists()) return;
      
      const daysData = scheduleSnap.data().days || {};
      const sessionsToday: Session[] = daysData[dateStr] || [];
      
      if (sessionsToday.length === 0) {
          await dbService.updateAttendanceSingle(user, appId, date, playerId, null);
          return;
      }
      
      // 2. Count total sessions and sessions attended by this player
      const totalSessions = sessionsToday.length;
      const attendedSessions = sessionsToday.filter(s => s.attendees?.includes(playerId)).length;
      
      let status = null;
      if (attendedSessions === 0) {
          status = 'A'; // Assume Absent if 0 sessions attended but sessions exist
      } else if (totalSessions === 1) {
          status = 'P'; // Present for single session
      } else {
          status = `${attendedSessions}/${totalSessions}`; // Fractional for multiple sessions
      }
      
      await dbService.updateAttendanceSingle(user, appId, date, playerId, status);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTIONS.SCHEDULES);
    }
  },

  subscribeYTP: (user: any, appId: string, docIdPart: string, cb: (data: any) => void) => {
    let docId = docIdPart; if (docIdPart.length === 4 && !docIdPart.includes('_')) docId = `${user.uid}_${docIdPart}`;
    if (isDemo(user)) { cb(getLocal('ytp')[docId]?.weeks || {}); return () => {}; }
    return onSnapshot(doc(db, COLLECTIONS.YTP, docId), 
      (snap) => cb(snap.exists() ? snap.data().weeks || {} : {}),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.YTP)
    );
  },

  saveYTP: async (user: any, appId: string, docIdPart: string, weeks: any) => {
    let docId = docIdPart; let year = parseInt(docIdPart.split('_')[0]); if (docIdPart.length === 4 && !docIdPart.includes('_')) { docId = `${user.uid}_${docIdPart}`; year = parseInt(docIdPart); }
    if (isDemo(user)) { const all = getLocal('ytp'); all[docId] = { weeks, year }; setLocal('ytp', all); }
    else {
      try {
        await setDoc(doc(db, COLLECTIONS.YTP, docId), sanitize({ weeks, year, userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.YTP);
      }
    }
  },
  
  subscribeAcademySettings: (user: any, appId: string, cb: (data: any) => void) => {
    if (isDemo(user)) { cb(getLocal('settings') || { name: 'Smash Academy', logoUrl: '' }); return () => {}; }
    return onSnapshot(doc(db, COLLECTIONS.SETTINGS, `settings_${user.uid}`), 
      (snap) => cb(snap.exists() ? snap.data() : { name: 'Smash Academy', logoUrl: '' }),
      (error) => handleFirestoreError(error, OperationType.GET, COLLECTIONS.SETTINGS)
    );
  },

  saveAcademySettings: async (user: any, appId: string, settings: any) => {
      if (isDemo(user)) setLocal('settings', settings);
      else {
        try {
          await setDoc(doc(db, COLLECTIONS.SETTINGS, `settings_${user.uid}`), sanitize({ ...settings, userId: user.uid }), { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.SETTINGS);
        }
      }
  },

  subscribeTournaments: (user: any, appId: string, cb: (data: Tournament[]) => void) => {
    if (isDemo(user)) { cb(getLocal('tournaments').sort((a: any, b: any) => b.startDate.localeCompare(a.startDate))); return () => {}; }
    const q = query(collection(db, COLLECTIONS.TOURNAMENTS), where('userId', '==', user.uid));
    return onSnapshot(q, 
      (snap) => { const data = snap.docs.map(d => ({id: d.id, ...d.data()} as Tournament)); data.sort((a, b) => b.startDate.localeCompare(a.startDate)); cb(data); },
      (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.TOURNAMENTS)
    );
  },

  saveTournament: async (user: any, appId: string, data: Tournament) => {
    if (isDemo(user)) { const list = getLocal('tournaments'); const idx = list.findIndex((i: any) => i.id === data.id); if (idx > -1) list[idx] = data; else list.push(data); setLocal('tournaments', list); }
    else {
      try {
        await setDoc(doc(db, COLLECTIONS.TOURNAMENTS, data.id), sanitize({ ...data, userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.TOURNAMENTS);
      }
    }
  },

  deleteTournament: async (user: any, appId: string, id: string) => {
     if (isDemo(user)) setLocal('tournaments', getLocal('tournaments').filter((i: any) => i.id !== id));
     else {
       try {
         await deleteDoc(doc(db, COLLECTIONS.TOURNAMENTS, id));
       } catch (error) {
         handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.TOURNAMENTS);
       }
     }
  },

  subscribeTournamentEntries: (user: any, appId: string, tournamentId: string, cb: (data: TournamentEntry[]) => void) => {
    if (isDemo(user)) { cb(getLocal('tournamentEntries').filter((e: any) => e.tournamentId === tournamentId)); return () => {}; }
    const q = query(collection(db, COLLECTIONS.TOURNAMENT_ENTRIES), where('userId', '==', user.uid), where('tournamentId', '==', tournamentId));
    return onSnapshot(q, 
      (snap) => cb(snap.docs.map(d => ({id: d.id, ...d.data()} as TournamentEntry))),
      (error) => handleFirestoreError(error, OperationType.LIST, COLLECTIONS.TOURNAMENT_ENTRIES)
    );
  },

  getPlayerResults: async (user: any, appId: string, playerId: string): Promise<TournamentEntry[]> => {
    if (isDemo(user)) {
        const entries = getLocal('tournamentEntries').filter((e: any) => e.playerId === playerId);
        const tournaments = getLocal('tournaments');
        return entries.map((e: any) => ({ ...e, tournamentName: tournaments.find((tour: any) => tour.id === e.tournamentId)?.name || 'Unknown', tournamentDate: tournaments.find((tour: any) => tour.id === e.tournamentId)?.startDate || '' })).sort((a: any, b: any) => b.tournamentDate.localeCompare(a.tournamentDate));
    }
    try {
      const q = user.role === 'PLAYER' 
        ? query(collection(db, COLLECTIONS.TOURNAMENT_ENTRIES), where('playerId', '==', playerId))
        : query(collection(db, COLLECTIONS.TOURNAMENT_ENTRIES), where('userId', '==', user.uid), where('playerId', '==', playerId));
      
      const entrySnap = await getDocs(q);
      const entries = entrySnap.docs.map(d => ({id: d.id, ...d.data()} as unknown as TournamentEntry));
      const tournamentIds = [...new Set(entries.map(e => e.tournamentId))];
      const tournamentMap: Record<string, Tournament> = {};
      await Promise.all(tournamentIds.map(async (tid: string) => {
          if (!tid) return;
          const tSnap = await getDoc(doc(db, COLLECTIONS.TOURNAMENTS, tid));
          if (tSnap.exists()) tournamentMap[tid] = {id: tSnap.id, ...tSnap.data()} as any;
      }));
      return entries.map(e => ({ ...e, tournamentName: tournamentMap[e.tournamentId]?.name || 'Unknown', tournamentDate: tournamentMap[e.tournamentId]?.startDate || '' })).sort((a: any, b: any) => (b.tournamentDate || '').localeCompare(a.tournamentDate || ''));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTIONS.TOURNAMENT_ENTRIES);
      return [];
    }
  },

  saveTournamentEntry: async (user: any, appId: string, data: TournamentEntry) => {
    if (isDemo(user)) { const list = getLocal('tournamentEntries'); const idx = list.findIndex((i: any) => i.id === data.id); if (idx > -1) list[idx] = data; else list.push(data); setLocal('tournamentEntries', list); }
    else {
      try {
        await setDoc(doc(db, COLLECTIONS.TOURNAMENT_ENTRIES, data.id), sanitize({ ...data, userId: user.uid }), { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.TOURNAMENT_ENTRIES);
      }
    }
  },

  deleteTournamentEntry: async (user: any, appId: string, id: string) => {
    if (isDemo(user)) setLocal('tournamentEntries', getLocal('tournamentEntries').filter((i: any) => i.id !== id));
    else {
      try {
        await deleteDoc(doc(db, COLLECTIONS.TOURNAMENT_ENTRIES, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, COLLECTIONS.TOURNAMENT_ENTRIES);
      }
    }
  }
};
