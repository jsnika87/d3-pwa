import JoinClient from "../JoinClient";

export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ inviteId: string }>;
}) {
  const { inviteId } = await params;

  return <JoinClient initialCode={inviteId} autoSubmit />;
}