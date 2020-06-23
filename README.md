# Vidi: A compact template rendering system
So this is a smallish JS implementation that quacks and waggles a lot like
Vue. The main difference is the way the view proxy is handled can take hits
to the view's subtree without needing to be coaxed into rendering. Plus it
has a component system set up the way that made sense to me.

Created mainly for the purpose of dogfooding, but if you find it useful or
want to contribute, you're always welcome.
