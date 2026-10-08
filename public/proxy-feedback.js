// Observe the controller's fetch boundary so failures can be explained outside its iframe.
export function watchFrame(frame, onFailure, onDocumentReady = () => {}) {
  const original = frame.fetchHandler.handleFetch.bind(frame.fetchHandler);
  frame.fetchHandler.handleFetch = async request => {
    // Scramjet marks nested frames with $iframe=1. Their failures must not
    // replace the whole game/browser view or falsely report its page as loaded.
    const nestedFrame = request.rawUrl?.searchParams?.get('$iframe') === '1';
    const documentRequest = !nestedFrame && (request.mode === 'navigate' || ['document','iframe'].includes(request.rawDestination));
    try {
      const response = await original(request);
      if(documentRequest){
        if(response.status >= 400) onFailure('This page returned an error ('+response.status+'). Please try again later.');
        else if(response.status>=200&&response.status<300)onDocumentReady();
      }
      return response;
    } catch(error) {
      if(documentRequest) onFailure('The connection failed. The site may be unavailable or incompatible with the proxy.');
      throw error;
    }
  };
}
