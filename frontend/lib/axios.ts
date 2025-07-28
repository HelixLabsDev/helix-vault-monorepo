/* eslint-disable @typescript-eslint/no-explicit-any */

import axios from "axios";

const _axios: any = axios.create({
  baseURL: "https://icp-vault-backend-f13dd7e78caa.herokuapp.com/icp",
  timeout: 50 * 1000,
});

export default _axios;
