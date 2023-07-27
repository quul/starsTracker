import {Octokit} from "@octokit/rest";

const createOctokit = (token: string) => new Octokit({
  auth: token,
  userAgent: `starsTracker/0.0.1`,
  timeZone: "Asia/Shanghai",
})

export {createOctokit}