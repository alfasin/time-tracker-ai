import axios from 'axios';

async function checkEntries() {
  try {
    // Login
    const loginRes = await axios.post('https://tt-api.tikalk.dev/login', {
      email: 'nir.alfasi@tikalk.com',
      password: 'eK1726132362s'
    });

    const token = loginRes.data.token;
    console.log('✓ Logged in');

    // Get reports for November 30
    const reportsRes = await axios.get('https://tt-api.tikalk.dev/user/reports', {
      params: {
        startDate: '2024-11-30',
        endDate: '2024-11-30'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const nov30Reports = reportsRes.data;
    console.log(`\nFound ${nov30Reports.length} entries for 2025-11-30:\n`);

    nov30Reports.forEach((report, index) => {
      console.log(`Entry ${index + 1}:`);
      console.log(`  ID: ${report.id}`);
      console.log(`  Project: ${report.project}`);
      console.log(`  Task: ${report.task}`);
      console.log(`  Duration: ${report.duration} hours`);
      console.log(`  Note: ${report.note}`);
      console.log('');
    });

    // Get ALL November reports to see overall picture
    const allNovRes = await axios.get('https://tt-api.tikalk.dev/user/reports', {
      params: {
        yearMonth: '2024-11'
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`\nTotal entries for November 2024: ${allNovRes.data.length}`);

    // Group by date to see duplicates
    const byDate = {};
    allNovRes.data.forEach(report => {
      const date = report.date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(report);
    });

    // Show dates with multiple entries
    console.log('\nDates with multiple entries:');
    Object.entries(byDate)
      .filter(([date, reports]) => reports.length > 2)
      .forEach(([date, reports]) => {
        console.log(`\n${date}: ${reports.length} entries`);
        reports.forEach(r => {
          console.log(`  - ${r.project}/${r.task}: ${r.duration}h`);
        });
      });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkEntries();
