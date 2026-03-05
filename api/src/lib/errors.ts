export function replyError(
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  code: number,
  error: string,
  codeLabel?: string
) {
  return reply.status(code).send({
    error,
    ...(codeLabel && { code: codeLabel }),
  });
}
