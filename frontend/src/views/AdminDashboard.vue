<template>
  <div class="card" style="max-width: 600px; margin: 50px auto;">
    <h2>Admin Dashboard</h2>
    <p>Welcome! Based on your roles, you have access to the following panels:</p>
    
    <div style="display: flex; gap: 15px; margin-top: 20px;">
      <router-link 
        v-for="link in availableLinks" 
        :key="link.path" 
        :to="link.path"
        style="padding: 15px; background: #e0e0e0; text-decoration: none; border-radius: 8px; color: black; font-weight: bold;"
      >
        👉 {{ link.title }}
      </router-link>
    </div>

    <button @click="logout" style="margin-top: 30px; padding: 8px 15px; background: #ff4d4f; color: white; border: none; border-radius: 4px; cursor: pointer;">
      Logout
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const availableLinks = ref([]);

// Master configuration map: maps DB roles to UI Routes
const roleRoutesMap = {
  'Manager': { title: 'Manager Panel', path: '/Manager_Panel' },
  'HR': { title: 'Human Resources Panel', path: '/HR_Panel' }
};

onMounted(() => {
  const token = localStorage.getItem('admin_token');
  const rolesStr = localStorage.getItem('admin_roles');
  
  if (!token || !rolesStr) {
    router.push('/admin/login');
    return;
  }

  const roles = JSON.parse(rolesStr);
  
  // Filter links based on the user's roles
  roles.forEach(role => {
    if (roleRoutesMap[role]) {
      availableLinks.value.push(roleRoutesMap[role]);
    }
  });
});

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_roles');
  router.push('/admin/login');
};
</script>