import axios from 'axios';

async function cleanup() {
  try {
    // Login
    const loginRes = await axios.post('https://tt-api.tikalk.dev/login', {
      email: 'nir.alfasi@tikalk.com',
      password: 'eK1726132362s'
    });

    const token = loginRes.data.token;
    console.log('✓ Logged in\n');

    // Get ALL November 2024 reports
    const allNovRes = await axios.get('https://tt-api.tikalk.dev/user/reports', {
      params: {
        yearMonth: '2024-11'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`Total entries for November 2024: ${allNovRes.data.length}\n`);

    // Group by date
    const byDate = {};
    allNovRes.data.forEach(report => {
      const date = report.date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(report);
    });

    // Find dates with duplicates (more than 2 entries = meeting + truvify)
    const duplicateDates = Object.entries(byDate)
      .filter(([date, reports]) => reports.length > 2)
      .map(([date, reports]) => ({ date, reports }));

    if (duplicateDates.length === 0) {
      console.log('✓ No duplicate entries found!');
      return;
    }

    console.log(`Found ${duplicateDates.length} dates with duplicate entries:\n`);

    for (const { date, reports } of duplicateDates) {
      console.log(`${date}: ${reports.length} entries`);

      // Group by project/task
      const byProjectTask = {};
      reports.forEach(r => {
        const key = `${r.project}/${r.task}`;
        if (!byProjectTask[key]) byProjectTask[key] = [];
        byProjectTask[key].push(r);
      });

      // Find duplicates within same project/task
      for (const [key, entries] of Object.entries(byProjectTask)) {
        if (entries.length > 1) {
          console.log(`  ${key}: ${entries.length} duplicate entries`);

          // Keep the first one, delete the rest
          const toKeep = entries[0];
          const toDelete = entries.slice(1);

          console.log(`    Keeping: ID ${toKeep.id} (${toKeep.duration}h)`);

          for (const entry of toDelete) {
            console.log(`    Deleting: ID ${entry.id} (${entry.duration}h)`);

            try {
              await axios.post(
                'https://tt-api.tikalk.dev/time/delete',
                { id: String(entry.id) },
                {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              console.log(`      ✓ Deleted`);
            } catch (error) {
              console.log(`      ✗ Failed to delete: ${error.message}`);
            }
          }
        }
      }
      console.log('');
    }

    console.log('\n✓ Cleanup completed!');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

cleanup();
