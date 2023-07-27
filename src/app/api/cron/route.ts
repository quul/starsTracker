import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/prisma";
import {StarsOperates} from '@prisma/client'
import {createOctokit} from "@/lib/octokit";

const handler = async (req: NextRequest) => {
  const processInfo = {
    activeUser: 0,
    modifiedUsers: 0,
    modifiedUserList: [] as string[],
    addedStars: 0,
    deletedStars: 0,
  }
  // Cron triggered
  // Get all the users
  const accounts = await prisma.account.findMany({
    where: {
      provider: 'github'
    },
    select: {
      access_token: true,
      userId: true,
      user: true,
    }
  })
  processInfo.activeUser = accounts.length
  for (const {access_token: accessToken, user, userId} of accounts) {
    if (accessToken === null) continue
    // TODO:看起来star信息是公开的，可以用username直接访问，后期可以考虑改一下
    const octokit = createOctokit(accessToken)

    // Getting starred repo now
    let isEnd = false
    let page = 2
    // FIXME: 迟早得处理一下类型问题
    let currentStarsList = (await octokit.rest.activity.listReposStarredByAuthenticatedUser({
      headers: {
        // Accept: "application/vnd.github.star+json",
        'X-GitHub-Api-Version': '2022-11-28'
      },
      per_page: 100,
    })).data
    if (currentStarsList.length !== 100) {
      isEnd = true
    }
    while (!isEnd) {
      const starInfoCurrentPage = await octokit.rest.activity.listReposStarredByAuthenticatedUser({
        headers: {
          // Accept: "application/vnd.github.star+json",
          'X-GitHub-Api-Version': '2022-11-28'
        },
        per_page: 100,
        page,
      })
      currentStarsList.push(...starInfoCurrentPage.data)
      if (starInfoCurrentPage.data.length !== 100) {
        isEnd = true
      }
      page += 1
    }

    // Calculate the diff
    const oldStarsList = await prisma.stars.findMany({
      select: {
        repoId: true
      },
      where: {
        userId,
        isRemoved: false,
      },
    })
    const addedStars = currentStarsList.filter(currentStar => {
      return !oldStarsList.some(oldStar => oldStar.repoId === currentStar.id);
    })
    const deletedStars = oldStarsList.filter(oldStar => {
      return !currentStarsList.some(currentStar => currentStar.id === oldStar.repoId);
    })
    if (addedStars.length + deletedStars.length === 0) {
      continue
    }
    processInfo.addedStars += addedStars.length
    processInfo.deletedStars += deletedStars.length
    processInfo.modifiedUserList.push(user.name!)
    processInfo.modifiedUsers += 1

    // Write to db
    // Stars
    const newStarsIntoDB = addedStars.map(addedStar => {
      return {
        createAt: new Date(addedStar.created_at!),
        repoId: addedStar.id,
        content: addedStar
      }
    })
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        stars: {
          createMany: {
            data: newStarsIntoDB,
          }
        }
      }
    })
    await prisma.stars.deleteMany({
      where: {
        repoId: {in: deletedStars.map(deletedStar => deletedStar.repoId)}
      }
    })
    // StarsLog
    const starsLog = [
      ...addedStars.map(addedStar => {
        return {
          type: StarsOperates.ADD,
          repoId: addedStar.id,
          content: addedStar,
        }
      }),
      ...deletedStars.map(deletedStar => {
        return {
          type: StarsOperates.DELETE,
          repoId: deletedStar.repoId,
        }
      }),
    ]
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        starsLog: {
          createMany: {
            data: starsLog
          }
        }
      }
    })
  }

  return NextResponse.json({status: 'ok', processInfo})
}

export {handler as GET, handler as POST}