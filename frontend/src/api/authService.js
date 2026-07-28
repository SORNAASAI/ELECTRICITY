import axiosInstance from "./axiosInstance";

export const loginUser = async (email, password) => {
  const { data } = await axiosInstance.post("/api/auth/login", { email, password });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify({ name: data.name, email: data.email }));
  return data;
};

export const registerUser = async (name, email, password) => {
  const { data } = await axiosInstance.post("/api/auth/register", { name, email, password });
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify({ name: data.name, email: data.email }));
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

export const isAuthenticated = () => !!localStorage.getItem("token");
