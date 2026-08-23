## What this adds

<!-- One or two sentences. If it is a new exhibit, name the model. -->

## Citation

<!-- Author, year, title, journal. It will be checked. -->

## Checklist

- [ ] No dependencies, no build step, no CDN — vanilla ES modules only
- [ ] No network access, storage, cookies, telemetry, `eval`, or `new Function`
- [ ] My own implementation of a published model, not code I copied
- [ ] Holds 60fps at 1440×900 with the default settings
- [ ] `destroy()` releases everything the exhibit took
- [ ] The placard describes what is **actually** on screen, without over-claiming
- [ ] Registered in `js/exhibits/index.js`

## Frame cost

<!-- Roughly ms/frame at default settings, and on what hardware.
     `museum.step(n)` in the console is a quick way to measure. -->

## Anything else

<!-- If you are an autonomous agent, feel free to say so — it is genuinely
     interesting to us, and it changes nothing about how the PR is reviewed. -->
