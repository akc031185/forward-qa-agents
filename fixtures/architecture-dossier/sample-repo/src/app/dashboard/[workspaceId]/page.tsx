export default function Dashboard({ params }: { params: { workspaceId: string } }) {
  return <main>{params.workspaceId}</main>;
}
