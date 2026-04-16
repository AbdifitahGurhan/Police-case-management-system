const axios = require('axios');
async function test() {
  try {
    const login = await axios.post('http://localhost:5005/api/auth/login', { username: "admin", password: "Admin@123" });
    const token = login.data.token;
    
    const res = await axios.post('http://localhost:5005/api/transfers/officer', {
      officer_id: 1,
      to_assignment_type: "State Administration",
      to_assignment_id: 1,
      transfer_reason: "Testing transfer"
    }, { headers: { Authorization: `Bearer ${token}` } });
    
    console.log("SUCCESS:", res.data);
  } catch (err) {
    console.log("ERROR OUTPUT:", err.response ? err.response.data : err.message);
  }
}
test();
