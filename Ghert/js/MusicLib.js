let trackUrl = '';
let trackTitle = "";
//Can be made more flex and dynamic later  - just for now as we will have a fixed number of tracks with URL's
const trackUrls =[
    '../music/Chicane.mp3',
    '../music/Ground Effect.mp3',
    '../music/Serenity.mp3',
    '../music/Solitary.mp3',
   ]

let selectedTrack = trackUrls[0];

const trackTitles=[
    'Bio Unit - Chicane',
    'Bio Unit - Ground Effect',
    'Bio Unit - Serenity',
    'Bio Unit - Solitary',
]

//reusuable function to play a selected track
function playIt(currentTrack, currentTrackTitle)
{
    let MusicUrl = switchMusic(currentTrack);
    selectedTrack = new Audio(MusicUrl);
    stopIt(selectedTrack);
    selectedTrack.loop = true;
    selectedTrack.pause();
    selectedTrack.volume = 0.2;
    selectedTrack.play();
    defTitle(currentTrack)
}

//reusuable function to play a selected track
function stopIt(currentTrack)
{
    selectedTrack.pause();
    selectedTrack.currentTime = 0;
}

// update track title method for UI based on current track selection
function defTitle(currentTrack) {
    const playingUI = document.getElementById('currentTrack');

    trackTitle = trackTitles[currentTrack];

    let newTitle = document.createElement('p');
    newTitle.classList.add("TrackTitleP");

    const textNode = document.createTextNode( trackTitle );
    const elements = document.getElementsByClassName("TrackTitleP");

    newTitle.appendChild(textNode);

    if (playingUI.classList.contains("TrackTitleP")) {
        playingUI.parentNode.removeChild(playingUI);
    }

    return playingUI.appendChild(textNode);
}

//function to switch and return current music track URL upon input
function switchMusic(selectedTrack){
    switch (selectedTrack) {
        case 0:
            trackUrl = trackUrls[0];
            return trackUrl
            break;
        case 1:
            trackUrl = trackUrls[1];
            return trackUrl
            break;
        case 2:
            trackUrl = trackUrls[2];
            return trackUrl
            break;
        case 3:
            trackUrl = trackUrls[3];
            return trackUrl
            break;
        default:
            trackUrl = trackUrls[0];
    }
}

export {
    switchMusic, playIt, stopIt, defTitle
}
