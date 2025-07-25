/* eslint-disable @typescript-eslint/no-explicit-any */

import axios from "axios";

const _axios: any = axios.create({
  baseURL: "https://helix-vault-abd3a5593d90.herokuapp.com/icp",
  timeout: 50 * 1000,
});

export default _axios;
