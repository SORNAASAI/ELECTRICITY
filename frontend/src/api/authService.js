import axiosInstance from "./axiosInstance";

export const loginUser = async (email, password) => {
  const { data } = await axiosInstance.post("/api/auth/login", { email, password });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify({ name: data.name, email: data.email, role: data.role }));
  return data;
};

export const registerUser = async (name, email, password, role) => {
  const { data } = await axiosInstance.post("/api/auth/register", { name, email, password, role });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify({ name: data.name, email: data.email, role: data.role }));
  return data;
};

export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
};

export const getUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

export const getRole = () => getUser()?.role || null;

export const isAuthenticated = () => !!localStorage.getItem("token");

export const isAnalyst  = () => getRole() === "ANALYST";
export const isOperator = () => getRole() === "OPERATOR";
