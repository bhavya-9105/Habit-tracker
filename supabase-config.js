/**
 * Supabase Configuration & Backend Stubs
 * Note: Replace placeholders with actual credentials from your Supabase Dashboard.
 */

const SUPABASE_URL = 'YOUR_SUPABASE_URL_PLACEHOLDER';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_PLACEHOLDER';

// Mock Supabase Client Stub
const supabase = {
    from: (table) => {
        console.log(`[Supabase Stub] Accessing table: ${table}`);
        return {
            select: () => Promise.resolve({ data: [], error: null }),
            insert: (data) => Promise.resolve({ data, error: null }),
            update: (data) => Promise.resolve({ data, error: null }),
            delete: () => Promise.resolve({ error: null })
        };
    }
};

/**
 * Fetches user data including level, xp, and existing habits.
 */
async function fetchUserData(userId) {
    console.log(`[Backend Stub] Fetching data for user: ${userId}`);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In a real app, this would be:
    // const { data, error } = await supabase.from('users').select('*').eq('id', userId);
    
    return {
        id: userId,
        name: 'Agent Alpha',
        level: 1,
        xp: 0,
        lifetimeCompletions: 0
    };
}

/**
 * Syncs the local habits array to the database.
 */
async function syncHabitsToDB(habits) {
    console.log(`[Backend Stub] Syncing ${habits.length} habits to DB.`);
    // Simulate network
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Stub call
    await supabase.from('habits').insert(habits);
    return true;
}

/**
 * Updates streak, completions log, and XP in the database when a habit is completed.
 */
async function updateStreakAndXPInDB(habitId, newStreak, newXP, newLevel, completionsLog) {
    console.log(`[Backend Stub] Updating Habit ${habitId} - Streak: ${newStreak}, XP: ${newXP}, Level: ${newLevel}`);
    
    await supabase.from('habits').update({ streak: newStreak, completionsLog }).eq('id', habitId);
    await supabase.from('users').update({ xp: newXP, level: newLevel });
    
    return true;
}

// Export functions for global use
window.BackendStubs = {
    fetchUserData,
    syncHabitsToDB,
    updateStreakAndXPInDB
};
