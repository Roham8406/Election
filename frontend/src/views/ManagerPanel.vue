<template>
  <div class="page-container" dir="rtl">
    <div class="card panel-wide">
      
      <div class="panel-header">
        <h2> مدیریت </h2>
        <button @click="logout" class="btn-danger btn-small">خروج</button>
      </div>

      <div class="tabs-container">
        <button 
          @click="activeTab = 'manage'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'manage' }"
        >
          مدیریت و ویرایش انتخابات
        </button>
        <button 
          @click="activeTab = 'create'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'create' }"
        >
          ساخت انتخابات جدید
        </button>
      </div>

      <div v-if="activeTab === 'manage'">
        
        <div class="form-layout items-stretch">
          <label class="text-dark">انتخابات مورد نظر را انتخاب کنید:</label>
          <select v-model="selectedElection" @change="loadElectionDetails" class="input-field full-width">
            <option disabled value="">یک مورد را انتخاب کنید...</option>
            <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
          </select>
        </div>

        <div v-if="editData.id" class="mt-20">
          
          <div class="alert-box section-card bg-shaded">
            <h3 class="text-dark mt-0">وضعیت فعلی: 
              <span v-if="editData.status === 'Waiting'" class="text-warning">در انتظار شروع</span>
              <span v-else-if="editData.status === 'Started'" class="text-success">در حال برگزاری</span>
              <span v-else class="text-error">پایان یافته</span>
            </h3>

            <div class="flex-row mt-20">
              <button @click="checkBotStatus" class="btn-secondary flex-1 m-0">
                🔍 بررسی دسترسی ربات کاربران
              </button>

              <button 
                v-if="editData.status === 'Waiting'"
                @click="startElection" 
                class="btn-success flex-1 m-0" 
              >
                شروع انتخابات و ارسال کلیدها
              </button>

              <button 
                v-if="editData.status === 'Started'"
                @click="endElection" 
                class="btn-danger flex-1 m-0" 
              >
                پایان انتخابات
              </button>
            </div>
          </div>

          <div class="section-card">
            <h3 class="text-dark mt-0 mb-15">ویرایش مشخصات</h3>
            <div class="grid-form">
              <div>
                <label>عنوان:</label>
                <input v-model="editData.title" type="text" class="input-field full-width mt-5">
              </div>
              <div>
                <label>حداکثر رای:</label>
                <input v-model="editData.max_votes" type="number" class="input-field full-width mt-5">
              </div>
              <button @click="saveElectionChanges" class="btn-primary m-0">ذخیره</button>
            </div>
          </div>

          <div class="section-card bg-shaded">
            <h3 class="text-dark mt-0 mb-15">👥 لیست کاندیداها</h3>
            
            <div class="flex-row mb-15">
              <input v-model="newCandidateName" type="text" placeholder="نام کاندیدای جدید..." @keyup.enter="addCandidate" class="input-field full-width m-0">
              <button @click="addCandidate" class="btn-success m-0">+ افزودن</button>
            </div>

            <ul class="candidates-list m-0 p-0">
              <li v-for="cand in candidates" :key="cand.id" class="candidate-item" style="justify-content: space-between; cursor: default;">
                <span>{{ cand.name }}</span>
                <button @click="deleteCandidate(cand.id)" class="btn-text text-error btn-delete">حذف ✖</button>
              </li>
              <li v-if="candidates.length === 0" class="text-muted text-center" style="list-style: none;">هنوز کاندیدایی ثبت نشده است.</li>
            </ul>
          </div>
        </div>
        
        <div v-else class="alert-box alert-info mt-20 text-center">
          برای مدیریت، لطفاً یک انتخابات را از منوی بالا انتخاب کنید.
        </div>

      </div>

      <div v-if="activeTab === 'create'">
        <div class="section-card bg-shaded">
          <h3 class="text-dark mt-0 mb-15">ساخت انتخابات جدید</h3>
          
          <div class="form-layout items-stretch">
            <div>
              <label class="form-label">عنوان انتخابات:</label>
              <input v-model="newElection.title" type="text" placeholder="مثال: انتخابات شورای صنفی ۱۴۰۳" class="input-field full-width m-0">
            </div>
            
            <div class="mt-15">
              <label class="form-label">حداکثر رای مجاز برای هر نفر:</label>
              <input v-model="newElection.max_votes" type="number" min="1" class="input-field full-width m-0">
            </div>
            
            <button @click="createElection" class="btn-primary full-width mt-20">
              ثبت و ایجاد انتخابات
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const activeTab = ref('manage');
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
      elections.value = data.elections.filter(e => e.status !== 'Ended');
      
      if (editData.value.id) {
        const updated = elections.value.find(e => e.id === editData.value.id);
        if (updated) {
          editData.value = { ...updated };
        } else {
          editData.value = { id: null, title: '', max_votes: 5, status: 'Waiting' };
          selectedElection.value = '';
          candidates.value = [];
        }
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
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections`, {
      method: 'POST',
      body: JSON.stringify(newElection.value)
    });
    if (data.success) {
      alert(data.message);
      newElection.value = { title: '', max_votes: 5 };
      await loadElectionsList();
      
      selectedElection.value = data.election.id;
      await loadElectionDetails();
      activeTab.value = 'manage';
    }
  } catch (err) {}
};

const endElection = async () => {
  if (!confirm('آیا از پایان دادن به این انتخابات اطمینان دارید؟ با این کار امکان رای‌دهی بسته شده و نتایج عمومی می‌شود.')) return;
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${editData.value.id}/end`, { method: 'POST' });
    if (data.success) {
      alert(data.message);
      await loadElectionsList();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('خطا در ارتباط با سرور');
  }
};

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_panels');
  router.push('/admin/login');
};
</script>