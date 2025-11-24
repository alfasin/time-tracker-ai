import axios from 'axios';

async function checkLive() {
  try {
    // Login
    const loginRes = await axios.post('https://tt-api.tikalk.dev/login', {
      email: 'nir.alfasi@tikalk.com',
      password: 'eK1726132362s'
    });

    const token = loginRes.data.token;
    console.log('✓ Logged in\n');

    // Check Nov 13 using LIVE endpoint
    console.log('Checking 2024-11-13 (live data):');
    const nov13 = await axios.get('https://tt-api.tikalk.dev/time/reports', {
      params: { date: '2024-11-13' },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`  Total: ${nov13.data.dayTotal}`);
    console.log(`  Entries: ${nov13.data.reports.length}`);
    nov13.data.reports.forEach(r => {
      console.log(`    - ${r.project}/${r.task}: ${r.duration}`);
    });

    console.log('\nChecking 2024-11-11 (live data):');
    const nov11 = await axios.get('https://tt-api.tikalk.dev/time/reports', {
      params: { date: '2024-11-11' },
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`  Total: ${nov11.data.dayTotal}`);
    console.log(`  Entries: ${nov11.data.reports.length}`);
    nov11.data.reports.forEach(r => {
      console.log(`    - ${r.project}/${r.task}: ${r.duration}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkLive();
