// Commit the private-origin page before navigating, so its Strict cookie is
// used on the first desktop request after a cross-site form submission.
if(document.body.dataset.ready==='true')location.replace('/');
