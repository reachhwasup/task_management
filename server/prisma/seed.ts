import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const [alice, bob, carol, dave] = await Promise.all(
    [
      { name: "Alice Nguyen", email: "alice@example.com", avatarColor: "#f97316" },
      { name: "Bob Martinez", email: "bob@example.com", avatarColor: "#3b82f6" },
      { name: "Carol Kim", email: "carol@example.com", avatarColor: "#10b981" },
      { name: "Dave Thompson", email: "dave@example.com", avatarColor: "#a855f7" },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, passwordHash },
      })
    )
  );

  const workspace = await prisma.workspace.upsert({
    where: { slug: "acme-inc" },
    update: {},
    create: {
      name: "Acme Inc",
      slug: "acme-inc",
      members: {
        create: [
          { userId: alice.id, role: "OWNER" },
          { userId: bob.id, role: "ADMIN" },
          { userId: carol.id, role: "MEMBER" },
          { userId: dave.id, role: "MEMBER" },
        ],
      },
    },
  });

  const team = await prisma.team.create({
    data: {
      name: "Product",
      description: "Product design & engineering",
      workspaceId: workspace.id,
      members: {
        create: [{ userId: alice.id }, { userId: bob.id }, { userId: carol.id }],
      },
    },
  });

  const [bugTag, featureTag, designTag] = await Promise.all([
    prisma.tag.create({ data: { name: "Bug", color: "#ef4444", workspaceId: workspace.id } }),
    prisma.tag.create({ data: { name: "Feature", color: "#3b82f6", workspaceId: workspace.id } }),
    prisma.tag.create({ data: { name: "Design", color: "#a855f7", workspaceId: workspace.id } }),
  ]);

  const project = await prisma.project.create({
    data: {
      name: "Website Redesign",
      description: "Refresh the marketing site and onboarding flow",
      color: "#6366f1",
      workspaceId: workspace.id,
      teamId: team.id,
      members: {
        create: [{ userId: alice.id }, { userId: bob.id }, { userId: carol.id }, { userId: dave.id }],
      },
      sections: {
        create: [
          { name: "To do", order: 0 },
          { name: "In progress", order: 1 },
          { name: "In review", order: 2 },
          { name: "Done", order: 3 },
        ],
      },
    },
    include: { sections: true },
  });

  const [todo, inProgress, inReview, done] = project.sections.sort((a, b) => a.order - b.order);

  const task1 = await prisma.task.create({
    data: {
      title: "Audit current site content",
      description: "Go through every page and note what copy needs updating.",
      projectId: project.id,
      sectionId: done.id,
      assignees: { create: { userId: carol.id } },
      createdById: alice.id,
      priority: "MEDIUM",
      completed: true,
      completedAt: inDays(-2),
      dueDate: inDays(-3),
      order: 0,
      followers: { create: [{ userId: alice.id }, { userId: carol.id }] },
      tags: { create: [{ tagId: designTag.id }] },
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: "Design new homepage hero section",
      description: "Explore 3 directions for the hero, include mobile layout.",
      projectId: project.id,
      sectionId: inProgress.id,
      assignees: { create: { userId: dave.id } },
      createdById: alice.id,
      priority: "HIGH",
      dueDate: inDays(2),
      order: 0,
      followers: { create: [{ userId: alice.id }, { userId: dave.id }, { userId: bob.id }] },
      tags: { create: [{ tagId: designTag.id }, { tagId: featureTag.id }] },
      comments: {
        create: [
          { userId: alice.id, content: "Let's keep it bold — lean into the new brand colors." },
          { userId: dave.id, content: "On it, will have drafts by tomorrow." },
        ],
      },
    },
  });

  await prisma.task.create({
    data: {
      title: "Add mobile nav breakpoint",
      projectId: project.id,
      sectionId: task2.sectionId,
      parentTaskId: task2.id,
      assignees: { create: { userId: dave.id } },
      createdById: alice.id,
      priority: "LOW",
      order: 0,
      followers: { create: [{ userId: dave.id }] },
    },
  });
  await prisma.task.create({
    data: {
      title: "Export final assets to Figma library",
      projectId: project.id,
      sectionId: task2.sectionId,
      parentTaskId: task2.id,
      assignees: { create: { userId: dave.id } },
      createdById: alice.id,
      priority: "LOW",
      order: 1,
      followers: { create: [{ userId: dave.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Fix broken signup form validation",
      description: "Email regex rejects valid + addresses.",
      projectId: project.id,
      sectionId: inReview.id,
      assignees: { create: { userId: bob.id } },
      createdById: carol.id,
      priority: "URGENT",
      dueDate: inDays(-1),
      order: 0,
      followers: { create: [{ userId: bob.id }, { userId: carol.id }] },
      tags: { create: [{ tagId: bugTag.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Write onboarding email sequence",
      projectId: project.id,
      sectionId: todo.id,
      assignees: { create: { userId: alice.id } },
      createdById: alice.id,
      priority: "MEDIUM",
      dueDate: inDays(5),
      order: 0,
      followers: { create: [{ userId: alice.id }] },
      tags: { create: [{ tagId: featureTag.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Set up analytics events for new funnel",
      projectId: project.id,
      sectionId: todo.id,
      assignees: { create: { userId: bob.id } },
      createdById: alice.id,
      priority: "MEDIUM",
      dueDate: inDays(0),
      order: 1,
      followers: { create: [{ userId: bob.id }] },
    },
  });

  await prisma.task.create({
    data: {
      title: "Review competitor landing pages",
      projectId: project.id,
      sectionId: todo.id,
      createdById: carol.id,
      priority: "LOW",
      order: 2,
      followers: { create: [{ userId: carol.id }] },
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        recipientId: dave.id,
        actorId: alice.id,
        type: "TASK_ASSIGNED",
        message: 'You were assigned to "Design new homepage hero section"',
        taskId: task2.id,
        projectId: project.id,
      },
      {
        recipientId: bob.id,
        actorId: carol.id,
        type: "COMMENT_ADDED",
        message: 'New comment on "Fix broken signup form validation"',
        projectId: project.id,
      },
    ],
  });

  console.log("Seed complete. Demo accounts (password: password123):");
  console.log("  alice@example.com (owner)");
  console.log("  bob@example.com (admin)");
  console.log("  carol@example.com (member)");
  console.log("  dave@example.com (member)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
