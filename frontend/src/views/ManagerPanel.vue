<template>
  <div class="card" style="max-width: 900px; margin: 40px auto; padding: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <h2>👔 پنل مدیریت ارشد (Manager)</h2>
      <button @click="logout" style="background: #ff4d4f; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">خروج</button>
    </div>

    <div style="display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px;">
      <button @click="activeTab = 'manage'" :style="activeTab === 'manage' ? activeTabStyle : inactiveTabStyle">📊 مدیریت و ویرایش انتخابات</button>
      <button @click="activeTab = 'create'" :style="activeTab === 'create' ? activeTabStyle : inactiveTabStyle">➕ ساخت انتخابات جدید</button>
    </div>

    <div v-if="activeTab === 'manage'">
      
      <div style="margin-bottom: 20px;">
        <label>انتخابات مورد نظر را انتخاب کنید:</label>
        <select v-model="selectedElection" @change="loadElectionDetails" style="width: 100%; padding: 10px; margin-top: 5px;">
          <option disabled value="">یک مورد را انتخاب کنید...</option>
          <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
        </select>
      </div>

      <div v-if="editData.id">
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ddd;">
          <h3 style="margin-top: 0;">وضعیت فعلی: 
            <span v-if="editData.status === 'Waiting'" style="color: orange;">در انتظار شروع</span>
            <span v-else-if="editData.status === 'Started'" style="color: green;">در حال برگزاری</span>
            <span v-else style="color: red;">پایان یافته</span>
          </h3>

          <div style="display: flex; gap: 15px; margin-top: 20px;">
            <button @click="checkBotStatus" style="flex: 1; padding: 12px; background: #607D8B; color: white; border: none; border-radius: 4px; cursor: pointer;">
              🔍 بررسی دسترسی ربات کاربران
            </button>

            <button 
              @click="startElection" 
              :disabled="editData.status !== 'Waiting'"
              :style="{ flex: 1, padding: '12px', background: editData.status === 'Waiting' ? '#4CAF50' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: editData.status === 'Waiting' ? 'pointer' : 'not-allowed' }"
            >
              🚀 شروع انتخابات و ارسال کلیدها
            </button>
          </div>
        </div>

        <div style="background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #ddd;">
          <h3 style="margin-top: 0; margin-bottom: 15px;">✏️ ویرایش مشخصات</h3>
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 10px; align-items: end;">
            <div>
              <label>عنوان:</label>
              <input v-model="editData.title" type="text" style="width: 100%; padding: 8px; margin-top: 5px;">
            </div>
            <div>
              <label>حداکثر رای:</label>
              <input v-model="editData.max_votes" type="number" style="width: 100%; padding: 8px; margin-top: 5px;">
            </div>
            <div>
              <label>وضعیت:</label>
              <select v-model="editData.status" style="width: 100%; padding: 8px; margin-top: 5px;">
                <option value="Waiting">Waiting</option>
                <option value="Started">Started</option>
                <option value="Ended">Ended</option>
              </select>
            </div>
            <button @click="saveElectionChanges" style="padding: 10px 15px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">ذخیره تغییرات</button>
          </div>
        </div>

        <div style="background: #f1f8e9; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #c5e1a5;">
          <h3 style="margin-top: 0; margin-bottom: 15px;">👥 لیست کاندیداها</h3>
          
          <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <input v-model="newCandidateName" type="text" placeholder="نام کاندیدای جدید..." @keyup.enter="addCandidate" style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
            <button @click="addCandidate" style="padding: 10px 20px; background: #8BC34A; color: white; border: none; border-radius: 4px; cursor: pointer;">+ افزودن کاندیدا</button>
          </div>

          <ul style="list-style: none; padding: 0; margin: 0;">
            <li v-for="cand in candidates" :key="cand.id" style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 10px; border: 1px solid #ddd; margin-bottom: 5px; border-radius: 4px;">
              <span>{{ cand.name }}</span>
              <button @click="deleteCandidate(cand.id)" style="color: red; border: none; background: none; cursor: pointer; font-weight: bold; font-size: 16px;">حذف ✖</button>
            </li>
            <li v-if="candidates.length === 0" style="color: gray; text-align: center; padding: 10px;">هنوز کاندیدایی ثبت نشده است.</li>
          </ul>
        </div>
      </div>
      
      <div v-else style="color: gray; text-align: center; padding: 40px; background: #f9f9f9; border-radius: 8px; border: 1px dashed #ccc;">
        برای مدیریت، لطفاً یک انتخابات را از منوی بالا انتخاب کنید.
      </div>

    </div>

    <div v-if="activeTab === 'create'">
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; border: 1px solid #bbdefb;">
        <h3 style="margin-top: 0; margin-bottom: 20px;">➕ ساخت انتخابات جدید</h3>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">عنوان انتخابات:</label>
          <input v-model="newElection.title" type="text" placeholder="مثال: انتخابات شورای صنفی ۱۴۰۳" style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">حداکثر رای مجاز برای هر نفر:</label>
          <input v-model="newElection.max_votes" type="number" min="1" style="width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        
        <button @click="createElection" style="width: 100%; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer;">
          ثبت و ایجاد انتخابات
        </button>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const activeTab = ref('manage');
const activeTabStyle = "flex: 1; padding: 12px; border: none; border-bottom: 3px solid #2196F3; background: transparent; font-weight: bold; color: #2196F3; cursor: pointer; transition: 0.3s;";
const inactiveTabStyle = "flex: 1; padding: 12px; border: none; border-bottom: 3px solid transparent; background: transparent; color: #777; cursor: pointer; transition: 0.3s;";
const API_URL = import.meta.env.VITE_API_URL || '';

const elections = ref([]);
const selectedElection = ref('');
const editData = ref({ id: null, title: '', max_votes: 5, status: 'Waiting' });
const candidates = ref([]);
const newCandidateName = ref('');

const newElection = ref({ title: '', max_votes: 5 });

const fetchAuth = async (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  if (!token) return logout();

  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers }
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Unauthorized');
  }
  return res.json();
};

const loadElectionsList = async () => {
  try {
    const data = await fetchAuth(`${API_URL}/api/elections`);
    if (data.success) {
      elections.value = data.elections;
      if (editData.value.id) {
        const updated = elections.value.find(e => e.id === editData.value.id);
        if (updated) editData.value = { ...updated };
      }
    }
  } catch (err) {}
};

onMounted(loadElectionsList);

const loadElectionDetails = async () => {
  const el = elections.value.find(e => e.id === selectedElection.value);
  if (el) {
    editData.value = { ...el };
    await loadCandidates(el.id);
  } else {
    editData.value = { id: null, title: '', max_votes: 5, status: 'Waiting' };
    candidates.value = [];
  }
};

const checkBotStatus = async () => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${editData.value.id}/check-status`);
    if (data.success) alert(data.message);
  } catch (err) {}
};

const startElection = async () => {
  if (!confirm('آیا مطمئن هستید؟ با این کار برای تمام افراد تایید شده کلید رمزنگاری پیامک می‌شود.')) return;
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${editData.value.id}/start`, { method: 'POST' });
    if (data.success) {
      alert(data.message);
      await loadElectionsList();
    } else {
      alert(data.error);
    }
  } catch (err) {}
};

const saveElectionChanges = async () => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${editData.value.id}`, {
      method: 'PUT',
      body: JSON.stringify(editData.value)
    });
    if (data.success) {
      alert(data.message);
      await loadElectionsList();
    }
  } catch (err) {}
};

const loadCandidates = async (electionId) => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${electionId}/candidates`);
    if (data.success) candidates.value = data.candidates;
  } catch (err) {}
};

const addCandidate = async () => {
  if (!newCandidateName.value.trim()) return;
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${editData.value.id}/candidates`, {
      method: 'POST',
      body: JSON.stringify({ name: newCandidateName.value })
    });
    if (data.success) {
      candidates.value.push(data.candidate);
      newCandidateName.value = '';
    }
  } catch (err) {}
};

const deleteCandidate = async (candidateId) => {
  if (!confirm('آیا کاندیدا حذف شود؟')) return;
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/candidates/${candidateId}`, { method: 'DELETE' });
    if (data.success) {
      candidates.value = candidates.value.filter(c => c.id !== candidateId);
    }
  } catch (err) {}
};

const createElection = async () => {
  if (!newElection.value.title) return alert('لطفاً عنوان انتخابات را وارد کنید.');
  try {
    const data = await fetchAuth(`${API_URL}/api/elections`, {
      method: 'POST',
      body: JSON.stringify(newElection.value)
    });
    if (data.success) {
      alert(data.message);
      newElection.value = { title: '', max_votes: 5 }; // ریست کردن فرم
      await loadElectionsList();
      
      selectedElection.value = data.election.id;
      await loadElectionDetails();
      activeTab.value = 'manage';
    }
  } catch (err) {}
};

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_panels');
  router.push('/admin/login');
};
</script>