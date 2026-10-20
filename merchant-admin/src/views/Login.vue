<template>
  <div class="login-page">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="panel page-card">
      <h1 class="title">天空外卖</h1>
      <el-form :model="form" :rules="rules" ref="formRef" label-position="top">
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" autocomplete="off" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            class="submit-btn"
            :loading="loading"
            @click="onSubmit"
            block
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { adminLogin } from "@/api/admin";
import { useAuthStore } from "@/stores/auth";
import { showError } from "@/utils/error";

const router = useRouter();
const auth = useAuthStore();

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  username: "",
  password: ""
});

const rules: FormRules = {
  username: [{ required: true, message: "请输入账号", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }]
};

const onSubmit = () => {
  if (!formRef.value) return;
  formRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const res = await adminLogin(form);
      auth.setAuth({
        token: res.token,
        admin: {
          id: res.id,
          userName: res.userName,
          name: res.name,
          role: res.role
        }
      });
      ElMessage.success("登录成功");
      router.push("/overview");
    } catch (e: any) {
      showError(e, "登录失败");
    } finally {
      loading.value = false;
    }
  });
};
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: #f3f4f6;
  color: #111827;
  overflow: hidden;
}

/* 与小程序登录页一致的柔和光斑背景 */
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

.orb-1 {
  width: 480px;
  height: 480px;
  top: -160px;
  left: -140px;
  background: rgba(37, 99, 235, 0.22);
}

.orb-2 {
  width: 420px;
  height: 420px;
  right: -120px;
  bottom: -120px;
  background: rgba(59, 130, 246, 0.16);
}

.panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
}

.title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.submit-btn {
  width: 100%;
  background: #2563eb;
  border: none;
}
</style>

