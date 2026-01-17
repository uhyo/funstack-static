/**
 * Converts a stream of raw RSC payload into an ES module that default-exports the payload as a string.
 */
export function rscToESModule(
  rscStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const { readable: finalStream, writable } = new TransformStream<Uint8Array>();
  const encoder = new TextEncoder();

  let isInString = false;
  (async () => {
    {
      const writer = writable.getWriter();
      await writer.write(encoder.encode(`export default \``));
      writer.releaseLock();
      isInString = true;
    }
    await rscStream.pipeTo(writable, { preventClose: true });
    {
      const writer = writable.getWriter();
      await writer.write(encoder.encode("`"));
      isInString = false;
      writer.close();
    }
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    const writer = writable.getWriter();
    if (isInString) {
      writer.write(
        encoder.encode(`;throw new Error(${JSON.stringify(message)});`),
      );
    } else {
      writer.write(
        encoder.encode(`;throw new Error(${JSON.stringify(message)})`),
      );
    }
    writable.close();
  });
  return finalStream;
}
