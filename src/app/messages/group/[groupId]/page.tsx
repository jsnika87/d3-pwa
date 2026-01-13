import GroupChatClient from "./GroupChatClient";

export default async function GroupChatPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return <GroupChatClient groupId={groupId} />;
}