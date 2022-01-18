let trackUrl = ''

//Can be made more flex and dynamic later  - just for now as we will have a fixed number of tracks with URL's
const trackUrls =[
    'Ghert/music/Bio Unit - Chicane.mp3',
    'Ghert/music/Bio Unit - Ground Effect.mp3',
    'Ghert/music/Bio Unit - Serenity.mp3',
    'Ghert/music/Bio Unit - Solitary.mp3',
   ]

//reusuable function to play a selected track
function playIt(currentTrack)
{
    let MusicUrl = switchMusic(currentTrack);
    let selectedTrack = new Audio(MusicUrl)
    selectedTrack.loop = true
    selectedTrack.play()
}

//function to switch and return current music track URL upon input
function switchMusic(selectedTrack){
    switch (selectedTrack) {
        case 0:
            trackUrl = trackUrls[0]
            return trackUrl
            break;
        case 1:
            trackUrl = trackUrls[1]
            return trackUrl
            break;
        case 2:
            trackUrl = trackUrls[2]
            return trackUrl
            break;
        case 3:
            trackUrl = trackUrls[3]
            return trackUrl
            break;
        default:
            trackUrl = trackUrls[0]
    }
}

export {
    switchMusic, playIt
}
